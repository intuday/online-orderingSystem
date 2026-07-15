// src/app/api/auth/signup/route.ts
//
// Creates a Firestore user profile after Firebase Auth account creation.
// Requires a valid Firebase ID token to verify the caller owns the UID.

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, getDoc, setDoc,
  serverTimestamp,
}                                    from "@/lib/firebase-admin";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Authentication ──────────────────────────────────────────────────────
    // Verify the caller owns the UID by checking their Firebase ID token.
    // This prevents any unauthenticated caller from creating arbitrary profiles.

    const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let verifiedUid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      verifiedUid   = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── Parse & Validate Body ───────────────────────────────────────────────

    const body = await req.json() as Record<string, unknown>;

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const name  = typeof body.name  === "string" ? body.name.trim()  : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // ── UID Ownership Check ─────────────────────────────────────────────────
    // The UID in the token must match the UID being registered.
    // Prevents one user from creating a profile on behalf of another.

    const uid = verifiedUid;

    // ── Idempotency Check ───────────────────────────────────────────────────
    // Do not overwrite an existing profile — prevents data loss on duplicate calls
    // and protects existing admin roles from being downgraded.

    const userRef  = doc(db, "users", uid);
    const existing = await getDoc(userRef);

    if (existing.exists()) {
      // Profile already exists — return it as-is
      return NextResponse.json({ success: true, profile: existing.data() });
    }

    // ── Create Profile ──────────────────────────────────────────────────────

    const profile = {
      uid,
      email,
      name:          name  || email.split("@")[0] || "User",
      phone,
      role:          "customer",
      restaurantId:  RESTAURANT_ID,
      emailVerified: false,
      totalOrders:   0,
      totalSpent:    0,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    };

    await setDoc(userRef, profile);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ error: "Signup failed" }, { status: 500 });
  }
}