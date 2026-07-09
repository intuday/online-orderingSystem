import {
  db, collection, getDocs, addDoc, doc,
  deleteDoc, query, where, serverTimestamp,
} from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// ✅ Correct RESTAURANT_ID
const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;

    const q = query(
      collection(db, "coupons"),
      where("restaurantId", "==", restaurantId)
    );
    const snapshot = await getDocs(q);
    const coupons = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return Response.json({ coupons });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ✅ Always correct RESTAURANT_ID use karo
    const restaurantId = RESTAURANT_ID;

    const couponData = {
      restaurantId,
      code:          body.code.toUpperCase(),
      description:   body.description   || "",
      discountType:  body.discountType  || "percentage",
      discountValue: Number(body.discountValue),
      minOrderValue: Number(body.minOrderValue) || 0,
      maxDiscount:   body.maxDiscount   || null,
      usageLimit:    body.usageLimit    || null,
      usedCount:     0,
      isActive:      body.isActive !== false,
      validFrom:     null,
      validTo:       null,
      createdAt:     serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "coupons"), couponData);

    return Response.json(
      { coupon: { id: docRef.id, ...couponData } },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body            = await request.json();
    const { id, ...rest } = body;
    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

    const ref = doc(db, "coupons", id);
    await ref.set(rest, { merge: true });

    return Response.json({ coupon: { id, ...rest } });
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

    await deleteDoc(doc(db, "coupons", id));

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}