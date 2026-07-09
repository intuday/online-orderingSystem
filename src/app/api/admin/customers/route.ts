import {
  db, collection, getDocs, doc,
  updateDoc, deleteDoc, query, where,
} from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

export async function GET() {
  try {
    // ✅ Users fetch karo
    const usersSnap = await getDocs(
      query(collection(db, "users"), where("role", "==", "customer"))
    );

    // ✅ Orders bhi fetch karo (customer data enrich karne ke liye)
    const ordersSnap = await getDocs(
      query(collection(db, "orders"), where("restaurantId", "==", RESTAURANT_ID))
    );

    const orders = ordersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

    // ✅ Phone number se orders group karo
    const ordersByPhone: Record<string, any[]> = {};
    const ordersByCustomerId: Record<string, any[]> = {};

    orders.forEach((order) => {
      if (order.customerPhone) {
        if (!ordersByPhone[order.customerPhone]) ordersByPhone[order.customerPhone] = [];
        ordersByPhone[order.customerPhone].push(order);
      }
      if (order.customerId) {
        if (!ordersByCustomerId[order.customerId]) ordersByCustomerId[order.customerId] = [];
        ordersByCustomerId[order.customerId].push(order);
      }
    });

    // ✅ Unique customers banao - users + orders se
    const customerMap = new Map<string, any>();

    // Users collection se
    usersSnap.docs.forEach((d) => {
      const data = d.data();
      const phone = data.phone || "";
      const key = phone || d.id;

      const customerOrders = ordersByCustomerId[d.id] || ordersByPhone[phone] || [];

      customerMap.set(key, {
        id:          d.id,
        name:        data.name || data.displayName || "Unknown",
        email:       data.email || null,
        phone:       phone || null,
        totalOrders: customerOrders.length,
        totalSpent:  customerOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
        lastOrderAt: customerOrders.length > 0
          ? customerOrders.sort((a: any, b: any) => {
              const aT = a.createdAt?._seconds || a.createdAt?.seconds || 0;
              const bT = b.createdAt?._seconds || b.createdAt?.seconds || 0;
              return bT - aT;
            })[0]?.createdAt
          : null,
        lastOrderStatus: customerOrders.length > 0
          ? customerOrders.sort((a: any, b: any) => {
              const aT = a.createdAt?._seconds || a.createdAt?.seconds || 0;
              const bT = b.createdAt?._seconds || b.createdAt?.seconds || 0;
              return bT - aT;
            })[0]?.status
          : null,
        orders:     customerOrders,
        createdAt:  data.createdAt || null,
        source:     "registered",
      });
    });

    // ✅ Orders se guest customers bhi add karo (jo register nahi kiye)
    orders.forEach((order) => {
      const phone = order.customerPhone;
      if (!phone) return;

      if (!customerMap.has(phone)) {
        const guestOrders = ordersByPhone[phone] || [];
        customerMap.set(phone, {
          id:            phone,
          name:          order.customerName || "Guest",
          email:         null,
          phone,
          totalOrders:   guestOrders.length,
          totalSpent:    guestOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
          lastOrderAt:   order.createdAt,
          lastOrderStatus: order.status,
          orders:        guestOrders,
          createdAt:     guestOrders.length > 0
            ? guestOrders.sort((a: any, b: any) => {
                const aT = a.createdAt?._seconds || a.createdAt?.seconds || 0;
                const bT = b.createdAt?._seconds || b.createdAt?.seconds || 0;
                return aT - bT;
              })[0]?.createdAt
            : order.createdAt,
          source:        "guest",
        });
      }
    });

    // ✅ Sort by last order (recent first)
    const customers = Array.from(customerMap.values()).sort((a, b) => {
      const aT = a.lastOrderAt?._seconds || a.lastOrderAt?.seconds || 0;
      const bT = b.lastOrderAt?._seconds || b.lastOrderAt?.seconds || 0;
      return bT - aT;
    });

    return Response.json({ customers });
  } catch (error) {
    console.error("Customers error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;
    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

    const docRef = doc(db, "users", id);
    await updateDoc(docRef, updateData);

    return Response.json({ customer: { id, ...updateData } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

    await deleteDoc(doc(db, "users", id));
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}