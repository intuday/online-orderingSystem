import {
  db, collection, getDocs, query, where,
} from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;
    const period       = searchParams.get("period") || "weekly";

    // ✅ No orderBy - no composite index needed
    const [ordersSnap, productsSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, "orders"),   where("restaurantId", "==", restaurantId))),
      getDocs(query(collection(db, "products"), where("restaurantId", "==", restaurantId))),
      getDocs(query(collection(db, "users"),    where("role", "==", "customer"))),
    ]);

    const orders   = ordersSnap.docs.map(d   => ({ id: d.id,   ...d.data() })) as any[];
    const products = productsSnap.docs.map(d => ({ id: d.id,   ...d.data() })) as any[];
    const users    = usersSnap.docs.map(d    => ({ id: d.id,   ...d.data() })) as any[];

    // Period filter
    const now  = Date.now();
    const days: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
    const cutoff = now - (days[period] || 7) * 24 * 60 * 60 * 1000;

    const getTime = (o: any) => {
      if (o.createdAt?.seconds)  return o.createdAt.seconds  * 1000;
      if (o.createdAt?._seconds) return o.createdAt._seconds * 1000;
      return 0;
    };

    const filtered = orders.filter(o => getTime(o) >= cutoff);

    // ── Summary ──────────────────────────────────────────────
    const totalRevenue    = filtered.reduce((s: number, o: any) => s + (o.total || 0), 0);
    const completedOrders = filtered.filter((o: any) => o.status === "delivered").length;
    const cancelledOrders = filtered.filter((o: any) => o.status === "cancelled").length;

    const summary = {
      totalRevenue,
      totalOrders:    filtered.length,
      completedOrders,
      cancelledOrders,
      avgOrderValue:  filtered.length > 0 ? totalRevenue / filtered.length : 0,
      totalCustomers: users.length,
    };

    // ── Payment Stats ─────────────────────────────────────────
    const paymentStats = {
      paid:   filtered.filter((o: any) => o.paymentStatus === "paid"   || o.isPaid === true).length,
      unpaid: filtered.filter((o: any) => o.paymentStatus !== "paid"   && o.isPaid !== true).length,
    };

    // ── Orders By Status ──────────────────────────────────────
    const ordersByStatus: Record<string, number> = {};
    filtered.forEach((o: any) => {
      const s = o.status || "unknown";
      ordersByStatus[s] = (ordersByStatus[s] || 0) + 1;
    });

    // ── Chart Data (daily breakdown) ──────────────────────────
    const chartMap: Record<string, { orders: number; revenue: number }> = {};
    filtered.forEach((o: any) => {
      const t = getTime(o);
      if (!t) return;
      const key = new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      if (!chartMap[key]) chartMap[key] = { orders: 0, revenue: 0 };
      chartMap[key].orders  += 1;
      chartMap[key].revenue += (o.total || 0);
    });

    const chartData = Object.entries(chartMap)
      .map(([date, v]) => ({ date, ...v }))
      .slice(-(days[period] || 7));

    // ── Top Items ─────────────────────────────────────────────
    const itemMap: Record<string, { id: string; name: string; price: number; orderCount: number; revenue: number }> = {};
    filtered.forEach((o: any) => {
      (o.items || []).forEach((item: any) => {
        const key = item.id || item.name;
        if (!itemMap[key]) {
          itemMap[key] = { id: key, name: item.name, price: item.price || 0, orderCount: 0, revenue: 0 };
        }
        itemMap[key].orderCount += (item.quantity || 1);
        itemMap[key].revenue    += (item.price || 0) * (item.quantity || 1);
      });
    });

    const topItems = Object.values(itemMap)
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, 10);

    return Response.json({
      summary,
      paymentStats,
      ordersByStatus,
      chartData,
      topItems,
      period,
    });

  } catch (error) {
    console.error("Reports error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}