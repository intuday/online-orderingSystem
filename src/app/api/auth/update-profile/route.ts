// src/app/api/auth/update-profile/route.ts
//
// Updates name and phone in the user's Firestore profile.
// The auth-token cookie contains a Firebase ID token — it cannot be
// re-issued server-side. The client must call firebaseUser.getIdToken()
// and re-POST to /api/auth/login to refresh the session cookie if needed.
// Profile fields (name, phone) are always read from Firestore by verify-status.

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, setDoc,
  serverTimestamp,
}                                    from "@/lib/firebase-admin";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Authentication ──────────────────────────────────────────────────────
    // Verify Firebase ID token from cookie.

    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid           = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    // ── Parse & Validate Body ───────────────────────────────────────────────

    const body = await req.json() as Record<string, unknown>;

    const name  = typeof body.name  === "string" ? body.name.trim()  : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // ── Update Firestore Profile ────────────────────────────────────────────
    // Only update name and phone — never allow role or restaurantId updates
    // through this endpoint.

    await setDoc(
      doc(db, "users", uid),
      {
        name,
        phone,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // ── Response ────────────────────────────────────────────────────────────
    // Cookie is NOT updated here — it contains a Firebase ID token which is
    // issued by Google and cannot be re-signed server-side.
    // The client reads updated profile data via /api/auth/verify-status
    // which always reads from Firestore.

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}