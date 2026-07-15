// src/app/api/admin/verify/route.ts
//
// Verifies admin token passed in request body.
// Used by client-side code that passes the token explicitly.
// For cookie-based verification use /api/auth/admin-verify instead.

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, getDoc,
}                                    from "@/lib/firebase-admin";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json() as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token : null;

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // ── Verify Firebase ID Token ────────────────────────────────────────────

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid           = decoded.uid;
    } catch {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    // ── Read Profile and Check Role ─────────────────────────────────────────

    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      return NextResponse.json({ valid: false }, { status: 403 });
    }

    const profile = userSnap.data() ?? {};
    const role    = (profile.role as string) ?? "customer";

    if (!ADMIN_ROLES.has(role)) {
      return NextResponse.json(
        { valid: false, error: "Admin privileges required" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      valid: true,
      user: {
        uid,
        email:        (profile.email        as string) ?? null,
        role,
        name:         (profile.name         as string) ?? "",
        restaurantId: (profile.restaurantId as string) ?? "",
      },
    });

  } catch (error) {
    console.error("Admin verify error:", error);
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}