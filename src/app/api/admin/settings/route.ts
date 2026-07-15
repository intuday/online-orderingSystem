// src/app/api/admin/settings/route.ts
import { NextRequest }           from "next/server";
import {
  db, doc, getDoc, setDoc,
  serverTimestamp, adminAuth,
  collection, getDocs, query, where,
}                                from "@/lib/firebase-admin";
import type { Restaurant }       from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "demo-restaurant";

// Fields that can be updated via PUT — prevents arbitrary Firestore writes
const ALLOWED_SETTINGS_FIELDS = new Set([
  "name", "description", "logo", "address", "phone", "email",
  "currency", "taxRate", "gstRate", "gstNumber", "isOpen",
  "paymentMode", "openingHours", "theme", "upiId",
  "acceptCash", "acceptCard",
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

// ─── GET /api/admin/settings ──────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const docSnap = await getDoc(doc(db, "restaurants", restaurantId));

    if (docSnap.exists()) {
      return Response.json({
        restaurant: { id: docSnap.id, ...docSnap.data() },
      });
    }

    // Return default shape if restaurant document does not exist yet
    const defaultRestaurant: Partial<Restaurant> = {
      name:         "The Royal Kitchen",
      description:  "Premium dining experience",
      logo:         "",
      address:      "123 MG Road, Bangalore",
      phone:        "+91 98765 43210",
      email:        "info@royalkitchen.com",
      gstNumber:    "29ABCDE1234F1Z5",
      gstRate:      5,
      currency:     "INR",
      paymentMode:  "both",
      openingHours: {},
      theme:        null,
    };

    return Response.json({
      restaurant: { id: restaurantId, ...defaultRestaurant },
    });

  } catch (error) {
    console.error("Settings GET error:", error);
    return Response.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// ─── PUT /api/admin/settings ──────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body         = await request.json() as Record<string, unknown>;
    const restaurantId = typeof body.restaurantId === "string"
      ? body.restaurantId
      : RESTAURANT_ID;

    // Whitelist — only known restaurant fields can be updated
    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_SETTINGS_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    const docRef = doc(db, "restaurants", restaurantId);
    await setDoc(docRef, updateData, { merge: true });

    // Return constructed response — avoids second getDoc read
    return Response.json({
      restaurant: {
        id: restaurantId,
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Settings PUT error:", error);
    return Response.json({ error: "Failed to update settings" }, { status: 500 });
  }
}