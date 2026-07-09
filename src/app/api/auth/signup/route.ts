// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db, doc, serverTimestamp,
} from "@/lib/firebase-admin";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const { uid, email, name, phone } = await req.json();

    if (!uid || !email) {
      return NextResponse.json({ error: "UID and email required" }, { status: 400 });
    }

    // ✅ Firestore mein user create karo
    const userRef = doc(db, "users", uid);
    await userRef.set({
      uid,
      email,
      name:          name  || email.split("@")[0],
      phone:         phone || "",
      role:          "customer",
      restaurantId:  RESTAURANT_ID,
      emailVerified: false,
      totalOrders:   0,
      totalSpent:    0,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}