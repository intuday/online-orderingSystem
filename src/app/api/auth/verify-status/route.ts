// src/app/api/auth/verify-status/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, getDoc,
}                                    from "@/lib/firebase-admin";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // ── Verify Firebase ID Token ──────────────────────────────────────────────

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid           = decoded.uid;
    } catch {
      // Token invalid or expired — clear cookie
      const response = NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
      response.cookies.set("auth-token", "", {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   0,
        path:     "/",
      });
      return response;
    }

    // ── Read Profile from Firestore ───────────────────────────────────────────

    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      return NextResponse.json({
        authenticated: true,
        user: {
          uid,
          email:        null,
          role:         "customer",
          name:         "",
          phone:        "",
          restaurantId: RESTAURANT_ID,
          displayName:  null,
          photoURL:     null,
        },
      });
    }

    const profile = userSnap.data() ?? {};

    return NextResponse.json({
      authenticated: true,
      user: {
        uid,
        email:        (profile.email        as string) ?? null,
        role:         (profile.role         as string) ?? "customer",
        name:         (profile.name         as string) ?? "",
        phone:        (profile.phone        as string) ?? "",
        // ✅ restaurantId empty hone pe env var se fallback
        restaurantId: (profile.restaurantId as string) || RESTAURANT_ID,
        displayName:  (profile.displayName  as string) ?? null,
        photoURL:     (profile.photoURL     as string) ?? null,
      },
    });

  } catch (error) {
    console.error("Verify status error:", error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}