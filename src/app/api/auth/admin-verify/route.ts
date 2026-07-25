// src/app/api/auth/admin-verify/route.ts
//
// Verifies that the current user has admin or super_admin role.
// Used by the admin layout to gate access to admin pages.
// Reads auth-token cookie (Firebase ID token) — no separate admin-token.

import { NextRequest, NextResponse } from "next/server";
import {
  db,
  doc, getDoc,
}                                    from "@/lib/firebase-admin";
import { verifyAdmin }               from "@/lib/auth/server-auth";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    // ── Verify Admin (token + role) ─────────────────────────────────────────

    const admin = await verifyAdmin(req);

    if (!admin) {
      // Not authenticated OR not an admin — clear cookie to be safe
      const response = NextResponse.json(
        { valid: false, error: "Admin privileges required" },
        { status: 401 }
      );
      // Clear cookie only if token was present but invalid
      if (req.cookies.get("auth-token")?.value) {
        response.cookies.set("auth-token", "", {
          httpOnly: true,
          secure:   process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge:   0,
          path:     "/",
        });
      }
      return response;
    }

    // ── Read full profile for name and restaurantId ─────────────────────────

    const userSnap = await getDoc(doc(db, "users", admin.uid));
    const profile  = userSnap.exists() ? (userSnap.data() ?? {}) : {};

    return NextResponse.json({
      valid:        true,
      uid:          admin.uid,
      email:        admin.email                          || null,
      role:         admin.role,
      name:         (profile.name         as string)     ?? "",
      restaurantId: (profile.restaurantId as string)     ?? "",
    });

  } catch (error) {
    console.error("Admin verify error:", error);
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}