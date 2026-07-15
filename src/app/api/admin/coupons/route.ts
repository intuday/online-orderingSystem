// src/app/api/admin/coupons/route.ts
import { NextRequest }       from "next/server";
import {
  db, collection, getDocs,
  addDoc, doc, deleteDoc, setDoc,
  query, where, serverTimestamp,
  adminAuth,
}                            from "@/lib/firebase-admin";
import type { Coupon }       from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// Fields that can be updated via PUT
const ALLOWED_COUPON_FIELDS = new Set([
  "code", "description", "discountType", "discountValue",
  "minOrderValue", "maxDiscount", "usageLimit", "isActive",
  "validFrom", "validTo",
]);

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
    return (role === "admin" || role === "super_admin") ? decoded.uid : null;
  } catch {
    return null;
  }
}

// ─── GET /api/admin/coupons ───────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const snapshot = await getDocs(
      query(
        collection(db, "coupons"),
        where("restaurantId", "==", restaurantId)
      )
    );

    const coupons = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Coupon[];

    return Response.json({ coupons });

  } catch (error) {
    console.error("Coupons GET error:", error);
    return Response.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

// ─── POST /api/admin/coupons ──────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;

    // Validate required fields
    const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
    if (!code) {
      return Response.json({ error: "Coupon code is required" }, { status: 400 });
    }

    const discountValue = Number(body.discountValue);
    if (!discountValue || discountValue <= 0) {
      return Response.json({ error: "Discount value must be greater than 0" }, { status: 400 });
    }

    const couponData = {
      restaurantId:  RESTAURANT_ID,
      code,
      description:   typeof body.description  === "string"  ? body.description  : "",
      discountType:  typeof body.discountType  === "string"  ? body.discountType : "percentage",
      discountValue,
      minOrderValue: typeof body.minOrderValue === "number"  ? body.minOrderValue : 0,
      maxDiscount:   typeof body.maxDiscount   === "number"  ? body.maxDiscount   : null,
      usageLimit:    typeof body.usageLimit    === "number"  ? body.usageLimit    : null,
      usageCount:    0,         // canonical field name — not usedCount
      isActive:      body.isActive !== false,
      validFrom:     null,
      validTo:       null,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "coupons"), couponData);

    return Response.json(
      {
        coupon: {
          id: docRef.id,
          ...couponData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Coupons POST error:", error);
    return Response.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}

// ─── PUT /api/admin/coupons ───────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body        = await request.json() as Record<string, unknown>;
    const { id, ...raw } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    // Whitelist — usageCount and restaurantId cannot be changed via this endpoint
    const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [key, value] of Object.entries(raw)) {
      if (ALLOWED_COUPON_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    // Normalize code to uppercase if provided
    if (typeof updateData.code === "string") {
      updateData.code = updateData.code.trim().toUpperCase();
    }

    await setDoc(doc(db, "coupons", id), updateData, { merge: true });

    return Response.json({
      coupon: {
        id,
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Coupons PUT error:", error);
    return Response.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/coupons ────────────────────────────────────────────────

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

    await deleteDoc(doc(db, "coupons", id));

    return Response.json({ success: true });

  } catch (error) {
    console.error("Coupons DELETE error:", error);
    return Response.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}