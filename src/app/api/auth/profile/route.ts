// src/app/api/auth/profile/route.ts
//
// Called by AuthContext on every auth state change with a fresh Firebase ID token.
// Token is passed via Authorization header (not cookie) to ensure freshness —
// cookies may contain a token that is close to expiry.

import { NextRequest, NextResponse } from "next/server";
import {
  db, adminAuth,
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
    // Token comes from AuthContext via Authorization header — always a fresh
    // Firebase ID token obtained from firebaseUser.getIdToken().

    const token = req.headers.get("Authorization")?.replace("Bearer ", "").trim();

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid     = decoded.uid;

    // ── Parse Body ──────────────────────────────────────────────────────────

    const body = await req.json() as Record<string, unknown>;

    // Sanitize — only accept known string fields, ignore anything else
    const email       = typeof body.email       === "string" ? body.email       : null;
    const displayName = typeof body.displayName === "string" ? body.displayName : null;
    const photoURL    = typeof body.photoURL    === "string" ? body.photoURL    : null;
    const phone       = typeof body.phone       === "string" ? body.phone       : null;

    // ── Read Existing Profile ───────────────────────────────────────────────

    const userRef = doc(db, "users", uid);
    const snap    = await getDoc(userRef);

    if (snap.exists()) {
      // Update lastLoginAt — keep profile fresh on every auth state change
      await setDoc(
        userRef,
        { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      );

      return NextResponse.json({ profile: snap.data() });
    }

    // ── Create New Profile ──────────────────────────────────────────────────
    // Matches the shape created by the login route for consistency.

    const now        = new Date().toISOString();
    const name       = displayName || email?.split("@")[0] || "User";

    const newProfile = {
      uid,
      email,
      displayName,
      name,
      photoURL,
      phone,
      role:         "customer",
      restaurantId: RESTAURANT_ID,
      totalOrders:  0,
      totalSpent:   0,
      emailVerified: decoded.email_verified ?? false,
      createdAt:    serverTimestamp(),
      updatedAt:    serverTimestamp(),
      lastLoginAt:  serverTimestamp(),
    };

    await setDoc(userRef, newProfile);

    // Return profile with ISO dates — serverTimestamp() is not JSON-serializable
    return NextResponse.json({
      profile: {
        ...newProfile,
        createdAt:   now,
        updatedAt:   now,
        lastLoginAt: now,
      },
    });

  } catch (err) {
    console.error("Profile API error:", err);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}