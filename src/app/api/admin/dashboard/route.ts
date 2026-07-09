import { db, collection, getDocs, query, where } from "@/lib/firebase-admin";
import type { Order, MenuItem } from "@/lib/firebase";

export const dynamic = "force-dynamic";

type AdminTable = {
  id: string;
  status?: string;
};

function toDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "object" && value !== null) {
    const v = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };

    if (typeof v.toDate === "function") {
      const d = v.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v.seconds === "number") {
      const d = new Date(v.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof v._seconds === "number") {
      const d = new Date(v._seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId =
      searchParams.get("restaurantId") ||
      process.env.NEXT_PUBLIC_RESTAURANT_ID ||
      "demo-restaurant";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ Simple queries only - no orderBy / no limit / no extra index
    const [ordersSnap, tablesSnap, productsSnap, customersSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "orders"),
          where("restaurantId", "==", restaurantId)
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
          where("restaurantId", "==", restaurantId)
        )
      ),
      getDocs(
        query(
          collection(db, "users"),
          where("restaurantId", "==", restaurantId)
        )
      ),
    ]);

    const allOrders = ordersSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Order[];

    const allTables = tablesSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as AdminTable[];

    const allProducts = productsSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MenuItem[];

    // ✅ JS sort instead of Firestore orderBy
    allOrders.sort((a, b) => {
      const aTime = toDate((a as any).createdAt)?.getTime() ?? 0;
      const bTime = toDate((b as any).createdAt)?.getTime() ?? 0;
      return bTime - aTime;
    });

    const todayOrders = allOrders.filter((o) => {
      const orderDate = toDate((o as any).createdAt);
      return orderDate ? orderDate >= today : false;
    });

    const totalRevenue = allOrders
      .filter((o) => (o as any).paymentStatus === "paid")
      .reduce((sum, o) => sum + (Number((o as any).total) || 0), 0);

    const todayRevenue = todayOrders
      .filter((o) => (o as any).paymentStatus === "paid")
      .reduce((sum, o) => sum + (Number((o as any).total) || 0), 0);

    const pendingOrders = allOrders.filter((o) => (o as any).status === "pending").length;
    const preparingOrders = allOrders.filter((o) => (o as any).status === "preparing").length;
    const activeTables = allTables.filter((t) => t.status === "occupied").length;

    // ✅ Popular items JS mein nikaalo
    const popularItems = [...allProducts]
      .sort((a, b) => ((b as any).orderCount ?? 0) - ((a as any).orderCount ?? 0))
      .slice(0, 5);

    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);

      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayOrders = allOrders.filter((o) => {
        const ot = toDate((o as any).createdAt);
        return ot ? ot >= d && ot < nextD : false;
      });

      return {
        date: d.toISOString().slice(5, 10),
        orders: dayOrders.length,
        revenue: dayOrders
          .filter((o) => (o as any).paymentStatus === "paid")
          .reduce((s, o) => s + (Number((o as any).total) || 0), 0),
      };
    });

    return Response.json({
      totalRevenue,
      todayRevenue,
      totalOrders: allOrders.length,
      todayOrders: todayOrders.length,
      pendingOrders,
      preparingOrders,
      totalCustomers: customersSnap.size,
      activeTables,
      totalTables: allTables.length,
      popularItems,
      recentOrders: allOrders.slice(0, 10),
      chartData: last7Days,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return Response.json({ error: "Failed to fetch dashboard" }, { status: 500 });
  }
}