// src/app/api/auth/admin-verify/route.ts
//
// Verifies that the current user has admin or super_admin role.
// Used by the admin layout to gate access to admin pages.
// Reads auth-token cookie (Firebase ID token) — no separate admin-token.

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, getDoc,
}                                    from "@/lib/firebase-admin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── Read Token ──────────────────────────────────────────────────────────
    // Single auth-token cookie — no separate admin-token.

    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // ── Verify Firebase ID Token ────────────────────────────────────────────

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid           = decoded.uid;
    } catch {
      // Token invalid or expired
      const response = NextResponse.json({ valid: false }, { status: 401 });
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   0,
        path:     "/",
      });
      return response;
    }

    // ── Read Profile from Firestore ─────────────────────────────────────────
    // Role is stored in Firestore — not in the Firebase ID token.

    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      return NextResponse.json({ valid: false }, { status: 403 });
    }

    const profile = userSnap.data() ?? {};
    const role    = (profile.role as string) ?? "customer";

    // ── Role Check ──────────────────────────────────────────────────────────

    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { valid: false, error: "Admin privileges required" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid:        true,
      uid,
      email:        (profile.email        as string) ?? null,
      role,
      name:         (profile.name         as string) ?? "",
      restaurantId: (profile.restaurantId as string) ?? "",
    });

  } catch (error) {
    console.error("Admin verify error:", error);
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}