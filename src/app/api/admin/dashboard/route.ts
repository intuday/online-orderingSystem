// src/app/api/admin/dashboard/route.ts
import {
  db, collection, getDocs,
  query, where, orderBy, limit,
}                        from "@/lib/firebase-admin";
import type { Order, MenuItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_ORDERS_LIMIT  = 10;
const POPULAR_ITEMS_LIMIT  = 5;
const DASHBOARD_ORDER_LIMIT = 500; // cap for stats calculation

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminTable {
  id:      string;
  status?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSeconds(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const v = value as Record<string, unknown>;
  if (typeof v._seconds === "number") return v._seconds;
  if (typeof v.seconds  === "number") return v.seconds;
  return 0;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "object" && value !== null) {
    const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof v.toDate   === "function") return v.toDate();
    if (typeof v.seconds  === "number")   return new Date(v.seconds  * 1000);
    if (typeof v._seconds === "number")   return new Date(v._seconds * 1000);
  }
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     =
      searchParams.get("restaurantId")         ??
      process.env.NEXT_PUBLIC_RESTAURANT_ID    ??
      "demo-restaurant";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Firestore Queries ───────────────────────────────────────────────────
    // Orders: capped at DASHBOARD_ORDER_LIMIT, sorted server-side
    // Tables and products: small collections — full fetch acceptable
    // Customers: count only — no document data needed

    const [ordersSnap, tablesSnap, productsSnap, customersSnap] =
      await Promise.all([
        getDocs(
          query(
            collection(db, "orders"),
            where("restaurantId", "==", restaurantId),
            orderBy("createdAt", "desc"),
            limit(DASHBOARD_ORDER_LIMIT)
          )
        ),
        getDocs(
          query(
            collection(db, "tables"),
            where("restaurantId", "==", restaurantId)
          )
        ),
        getDocs(
          query(
            collection(db, "products"),
            where("restaurantId", "==", restaurantId),
            orderBy("orderCount", "desc"),
            limit(POPULAR_ITEMS_LIMIT)
          )
        ),
        getDocs(
          query(
            collection(db, "users"),
            where("restaurantId", "==", restaurantId)
          )
        ),
      ]);

    const allOrders  = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];
    const allTables  = tablesSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AdminTable[];
    const popularItems = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[];

    // ── Compute Stats in a Single Pass ──────────────────────────────────────

    let totalRevenue   = 0;
    let todayRevenue   = 0;
    let totalOrders    = allOrders.length;
    let todayOrderCount = 0;
    let pendingOrders  = 0;
    let preparingOrders = 0;

    // Build chart buckets in one pass — O(n) instead of O(7n)
    const chartBuckets: Record<string, { orders: number; revenue: number }> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      chartBuckets[d.toISOString().slice(5, 10)] = { orders: 0, revenue: 0 };
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    for (const order of allOrders) {
      const isPaid   = order.paymentStatus === "paid";
      const total    = Number(order.total)  || 0;
      const orderDate = toDate(order.createdAt);

      if (isPaid) totalRevenue += total;

      if (orderDate && orderDate >= today) {
        todayOrderCount++;
        if (isPaid) todayRevenue += total;
      }

      if (order.status === "pending")   pendingOrders++;
      if (order.status === "preparing") preparingOrders++;

      // Chart data — only for last 7 days
      if (orderDate && orderDate >= sevenDaysAgo) {
        const key = orderDate.toISOString().slice(5, 10);
        if (chartBuckets[key]) {
          chartBuckets[key].orders++;
          if (isPaid) chartBuckets[key].revenue += total;
        }
      }
    }

    const chartData = Object.entries(chartBuckets).map(([date, v]) => ({
      date,
      orders:  v.orders,
      revenue: v.revenue,
    }));

    const activeTables = allTables.filter((t) => t.status === "occupied").length;

    return Response.json({
      totalRevenue,
      todayRevenue,
      totalOrders,
      todayOrders:    todayOrderCount,
      pendingOrders,
      preparingOrders,
      totalCustomers: customersSnap.size,
      activeTables,
      totalTables:    allTables.length,
      popularItems,
      recentOrders:   allOrders.slice(0, RECENT_ORDERS_LIMIT),
      chartData,
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return Response.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}