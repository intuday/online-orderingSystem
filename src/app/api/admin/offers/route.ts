// src/app/api/admin/offers/route.ts
import { NextRequest }         from "next/server";
import {
  db, collection, getDocs,
  addDoc, doc, deleteDoc, setDoc,
  query, where, serverTimestamp,
  adminAuth,
}                              from "@/lib/firebase-admin";
import type { OfferRule }      from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyAdmin(request: Request): Promise<string | null> {
  const req   = request as NextRequest;
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    const decoded  = await adminAuth.verifyIdToken(token);
    const userSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", decoded.uid))
    );
    if (userSnap.empty) return null;
    const role = userSnap.docs[0].data().role as string;
    if (role !== "admin" && role !== "super_admin") return null;
    return decoded.uid;
  } catch {
    return null;
  }
}

function buildOfferData(
  body: Record<string, unknown>,
  restaurantId: string
): Record<string, unknown> {
  return {
    restaurantId,
    title:            typeof body.title         === "string"  ? body.title         : "",
    description:      typeof body.description   === "string"  ? body.description   : "",
    image:            typeof body.image         === "string"  ? body.image         : "",
    offerType:        typeof body.offerType     === "string"  ? body.offerType     : "discount",
    discountType:     typeof body.discountType  === "string"  ? body.discountType  : "percentage",
    discountValue:    typeof body.discountValue === "number"  ? body.discountValue : 0,
    condition: body.condition ?? {
      requiredItemIds:     [],
      requiredCategoryIds: [],
      minQuantity:         1,
      minSubtotal:         0,
      matchType:           "any",
    },
    reward: body.reward ?? {
      rewardItemIds: [],
      promoPrice:    0,
      maxQuantity:   1,
      autoAdd:       false,
    },
    comboItems:       Array.isArray(body.comboItems) ? body.comboItems : [],
    comboPrice:       typeof body.comboPrice === "number" ? body.comboPrice : null,
    isActive:         body.isActive !== false,
    priority:         typeof body.priority         === "number" ? body.priority         : 0,
    maxUsagePerOrder: typeof body.maxUsagePerOrder === "number" ? body.maxUsagePerOrder : 1,
    validFrom:        body.validFrom ?? null,
    validTo:          body.validTo   ?? null,
  };
}

// ─── GET /api/admin/offers ────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const snapshot = await getDocs(
      query(
        collection(db, "offers"),
        where("restaurantId", "==", restaurantId)
      )
    );

    const offers = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    return Response.json({ offers });

  } catch (error) {
    console.error("Offers GET error:", error);
    return Response.json({ error: "Failed to fetch offers" }, { status: 500 });
  }
}

// ─── POST /api/admin/offers ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body       = await request.json() as Record<string, unknown>;
    const offerData  = {
      ...buildOfferData(body, RESTAURANT_ID),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "offers"), offerData);

    return Response.json(
      {
        offer: {
          id: docRef.id,
          ...offerData,
          // Replace server timestamps with ISO strings for client
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Offers POST error:", error);
    return Response.json({ error: "Failed to create offer" }, { status: 500 });
  }
}

// ─── PUT /api/admin/offers ────────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body            = await request.json() as Record<string, unknown>;
    const { id, ...rest } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    const updateData = {
      ...buildOfferData(rest, RESTAURANT_ID),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, "offers", id), updateData, { merge: true });

    return Response.json({
      offer: {
        id,
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Offers PUT error:", error);
    return Response.json({ error: "Failed to update offer" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/offers ─────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id               = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    await deleteDoc(doc(db, "offers", id));

    return Response.json({ success: true });

  } catch (error) {
    console.error("Offers DELETE error:", error);
    return Response.json({ error: "Failed to delete offer" }, { status: 500 });
  }
}