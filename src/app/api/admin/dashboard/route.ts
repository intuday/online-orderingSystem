// src/app/api/admin/dashboard/route.ts
import {
  db, collection, getDocs,
  query, where, orderBy, limit,
}                        from "@/lib/firebase-admin";
import type { Order, MenuItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RECENT_ORDERS_LIMIT   = 10;
const POPULAR_ITEMS_LIMIT   = 5;
const DASHBOARD_ORDER_LIMIT = 500;

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminTable {
  id:      string;
  status?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      searchParams.get("restaurantId")      ??
      process.env.NEXT_PUBLIC_RESTAURANT_ID ??
      "demo-restaurant";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ── Firestore Queries ─────────────────────────────────────────────────────
    // Promise.allSettled — ek query fail hone se dashboard crash nahi hoga

    const [ordersResult, tablesResult, productsResult, customersResult] =
      await Promise.allSettled([
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
        // ✅ Popular items — orderCount index required
        // Agar index missing ho toh fallback: sortOrder se fetch karo
        getDocs(
          query(
            collection(db, "products"),
            where("restaurantId", "==", restaurantId),
            orderBy("orderCount", "desc"),
            limit(POPULAR_ITEMS_LIMIT)
          )
        ).catch(() =>
          // Fallback — bina orderBy ke fetch karo agar index missing ho
          getDocs(
            query(
              collection(db, "products"),
              where("restaurantId", "==", restaurantId),
              limit(POPULAR_ITEMS_LIMIT)
            )
          )
        ),
        getDocs(
          query(
            collection(db, "users"),
            where("restaurantId", "==", restaurantId)
          )
        ),
      ]);

    // ── Extract Results ───────────────────────────────────────────────────────

    const allOrders = ordersResult.status === "fulfilled"
      ? ordersResult.value.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[]
      : [];

    const allTables = tablesResult.status === "fulfilled"
      ? tablesResult.value.docs.map((d) => ({ id: d.id, ...d.data() })) as AdminTable[]
      : [];

    const popularItems = productsResult.status === "fulfilled"
      ? productsResult.value.docs.map((d) => ({ id: d.id, ...d.data() })) as MenuItem[]
      : [];

    const totalCustomers = customersResult.status === "fulfilled"
      ? customersResult.value.size
      : 0;

    // Log partial failures — dashboard still returns data
    if (ordersResult.status   === "rejected") console.error("Dashboard orders error:",   ordersResult.reason);
    if (tablesResult.status   === "rejected") console.error("Dashboard tables error:",   tablesResult.reason);
    if (productsResult.status === "rejected") console.error("Dashboard products error:", productsResult.reason);
    if (customersResult.status === "rejected") console.error("Dashboard customers error:", customersResult.reason);

    // ── Compute Stats in Single Pass ──────────────────────────────────────────

    let totalRevenue    = 0;
    let todayRevenue    = 0;
    let todayOrderCount = 0;
    let pendingOrders   = 0;
    let preparingOrders = 0;

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
      const isPaid    = order.paymentStatus === "paid";
      const total     = Number(order.total) || 0;
      const orderDate = toDate(order.createdAt);

      if (isPaid) totalRevenue += total;

      if (orderDate && orderDate >= today) {
        todayOrderCount++;
        if (isPaid) todayRevenue += total;
      }

      if (order.status === "pending")   pendingOrders++;
      if (order.status === "preparing") preparingOrders++;

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
      totalOrders:    allOrders.length,
      todayOrders:    todayOrderCount,
      pendingOrders,
      preparingOrders,
      totalCustomers,
      activeTables,
      totalTables:    allTables.length,
      popularItems,
      recentOrders:   allOrders.slice(0, RECENT_ORDERS_LIMIT),
      chartData,
    });

  } catch (error) {
    console.error("Dashboard error:", error);
    return Response.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}