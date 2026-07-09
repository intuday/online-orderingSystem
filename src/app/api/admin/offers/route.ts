// src/app/api/admin/offers/route.ts
import {
  db, collection, getDocs, addDoc, doc,
  deleteDoc, query, where, serverTimestamp,
} from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;

    const q = query(
      collection(db, "offers"),
      where("restaurantId", "==", restaurantId)
    );
    const snapshot = await getDocs(q);
    const offers   = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    return Response.json({ offers });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = RESTAURANT_ID;

    const offerData: Record<string, unknown> = {
      restaurantId,

      // Basic info
      title:         body.title         || "",
      description:   body.description   || "",
      image:         body.image         || "",
      offerType:     body.offerType     || "discount",

      // Legacy fields (backward compat)
      discountType:  body.discountType  || "percentage",
      discountValue: body.discountValue || 0,

      // Condition
      condition: body.condition || {
        requiredItemIds:     [],
        requiredCategoryIds: [],
        minQuantity:         1,
        minSubtotal:         0,
        matchType:           "any",
      },

      // Reward
      reward: body.reward || {
        rewardItemIds: [],
        promoPrice:    0,
        maxQuantity:   1,
        autoAdd:       false,
      },

      // Combo specific
      comboItems:  body.comboItems  || [],
      comboPrice:  body.comboPrice  || null,

      // Metadata
      isActive:         body.isActive !== false,
      priority:         body.priority         || 0,
      maxUsagePerOrder: body.maxUsagePerOrder || 1,
      validFrom:        body.validFrom        || null,
      validTo:          body.validTo          || null,
      createdAt:        serverTimestamp(),
      updatedAt:        serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "offers"), offerData);

    return Response.json(
      { offer: { id: docRef.id, ...offerData } },
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

    rest.updatedAt = serverTimestamp();

    const ref = doc(db, "offers", id);
    await ref.set(rest, { merge: true });

    return Response.json({ offer: { id, ...rest } });
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

    await deleteDoc(doc(db, "offers", id));

    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}