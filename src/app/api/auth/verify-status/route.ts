// src/app/api/auth/verify-status/route.ts
//
// Verifies the auth-token cookie and returns the authenticated user's profile.
// Used by client components to check auth state and get user info.
//
// The auth-token cookie contains a Firebase ID token (not a custom JWT).
// We verify it with adminAuth.verifyIdToken() then read the full profile
// from Firestore — because Firebase ID tokens do not contain custom fields
// like role, phone, or restaurantId unless set as custom claims.

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, getDoc,
}                                    from "@/lib/firebase-admin";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // ── Verify Firebase ID Token ────────────────────────────────────────────

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid           = decoded.uid;
    } catch {
      // Token is invalid or expired — clear the cookie
      const response = NextResponse.json({ authenticated: false }, { status: 401 });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   0,
        path:     "/",
      });
      return response;
    }

    // ── Read Full Profile from Firestore ────────────────────────────────────
    // Firebase ID tokens do not include custom fields (role, phone, restaurantId).
    // We always read from Firestore to get the complete, up-to-date user profile.

    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      // Token is valid but no profile exists yet
      return NextResponse.json({
        authenticated: true,
        user: {
          uid,
          email:        null,
          role:         "customer",
          name:         "",
          phone:        "",
          restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "",
        },
      });
    }

    const profile = userSnap.data() ?? {};

    return NextResponse.json({
      authenticated: true,
      user: {
        uid,
        email:        (profile.email        as string)  ?? null,
        role:         (profile.role         as string)  ?? "customer",
        name:         (profile.name         as string)  ?? "",
        phone:        (profile.phone        as string)  ?? "",
        restaurantId: (profile.restaurantId as string)  ?? "",
        displayName:  (profile.displayName  as string)  ?? null,
        photoURL:     (profile.photoURL     as string)  ?? null,
      },
    });

  } catch (error) {
    console.error("Verify status error:", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}