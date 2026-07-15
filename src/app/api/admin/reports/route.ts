// src/app/api/admin/reports/route.ts
import { NextRequest }         from "next/server";
import {
  db, collection, getDocs,
  query, where, orderBy, limit,
  adminAuth,
}                              from "@/lib/firebase-admin";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const PERIOD_DAYS: Record<string, number> = {
  daily:   1,
  weekly:  7,
  monthly: 30,
  yearly:  365,
};

const REPORTS_ORDER_LIMIT = 1000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawOrder extends Order {
  isPaid?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMs(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const v = value as Record<string, unknown>;
  if (typeof v._seconds === "number") return v._seconds * 1000;
  if (typeof v.seconds  === "number") return v.seconds  * 1000;
  return 0;
}

async function verifyAdmin(request: Request): Promise<boolean> {
  const req   = request as NextRequest;
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return false;
  try {
    const decoded  = await adminAuth.verifyIdToken(token);
    const userSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", decoded.uid))
    );
    if (userSnap.empty) return false;
    const role = userSnap.docs[0].data().role as string;
    return role === "admin" || role === "super_admin";
  } catch {
    return false;
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;
    const period           = searchParams.get("period") ?? "weekly";
    const days             = PERIOD_DAYS[period] ?? 7;
    const cutoff           = Date.now() - days * 24 * 60 * 60 * 1000;

    // Fetch orders with server-side limit — no unbounded reads
    // Users: count only — fetch size not documents
    const [ordersSnap, usersSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "orders"),
          where("restaurantId", "==", restaurantId),
          orderBy("createdAt", "desc"),
          limit(REPORTS_ORDER_LIMIT)
        )
      ),
      getDocs(
        query(
          collection(db, "users"),
          where("restaurantId", "==", restaurantId),
          where("role", "==", "customer")
        )
      ),
    ]);

    const orders = ordersSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RawOrder[];

    // Filter to period in memory (after server-side limit)
    const filtered = orders.filter((o) => extractMs(o.createdAt) >= cutoff);

    // ── Single pass stats ───────────────────────────────────────────────────

    let totalRevenue    = 0;
    let completedOrders = 0;
    let cancelledOrders = 0;
    let paidCount       = 0;
    let unpaidCount     = 0;

    const ordersByStatus: Record<string, number>                          = {};
    const chartMap:       Record<string, { orders: number; revenue: number }> = {};
    const itemMap:        Record<string, { id: string; name: string; price: number; orderCount: number; revenue: number }> = {};

    for (const o of filtered) {
      const total  = Number(o.total) || 0;
      const isPaid = o.paymentStatus === "paid" || o.isPaid === true;

      totalRevenue += total;
      if (o.status === "completed") completedOrders++;
      if (o.status === "cancelled") cancelledOrders++;
      if (isPaid)  paidCount++;
      else         unpaidCount++;

      // Status breakdown
      const s = o.status ?? "unknown";
      ordersByStatus[s] = (ordersByStatus[s] ?? 0) + 1;

      // Chart breakdown
      const ms = extractMs(o.createdAt);
      if (ms) {
        const key = new Date(ms).toLocaleDateString("en-IN", {
          day:   "2-digit",
          month: "short",
        });
        const bucket = (chartMap[key] ??= { orders: 0, revenue: 0 });
        bucket.orders++;
        if (isPaid) bucket.revenue += total;
      }

      // Top items — use menuItemId as canonical key (not item.id which doesn't exist)
      const items = Array.isArray(o.items) ? (o.items as OrderItem[]) : [];
      for (const item of items) {
        const key = item.menuItemId || item.name;
        if (!key) continue;
        const entry = (itemMap[key] ??= {
          id:         key,
          name:       item.name,
          price:      item.price ?? 0,
          orderCount: 0,
          revenue:    0,
        });
        entry.orderCount += item.quantity ?? 1;
        entry.revenue    += (item.price ?? 0) * (item.quantity ?? 1);
      }
    }

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    const chartData = Object.entries(chartMap)
      .map(([date, v]) => ({ date, ...v }))
      .slice(-days);

    return Response.json({
      summary: {
        totalRevenue,
        totalOrders:    filtered.length,
        completedOrders,
        cancelledOrders,
        avgOrderValue:  filtered.length > 0
          ? Math.round(totalRevenue / filtered.length)
          : 0,
        totalCustomers: usersSnap.size,
      },
      paymentStats:  { paid: paidCount, unpaid: unpaidCount },
      ordersByStatus,
      chartData,
      topItems,
      period,
    });

  } catch (error) {
    console.error("Reports error:", error);
    return Response.json({ error: "Failed to generate report" }, { status: 500 });
  }
}