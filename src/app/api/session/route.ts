// src/app/api/session/route.ts
// NOTE: If this file is NOT session/route.ts, please confirm the correct path.
//
// Returns auth status from the auth-token cookie.
// Uses Firebase Admin SDK — not jsonwebtoken.

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth, db,
  doc, getDoc,
}                                    from "@/lib/firebase-admin";

// ─── Shared Handler ───────────────────────────────────────────────────────────

async function handleRequest(req: NextRequest): Promise<NextResponse> {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // ── Verify Firebase ID Token ────────────────────────────────────────────

    let uid: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid           = decoded.uid;
    } catch {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // ── Read Profile from Firestore ─────────────────────────────────────────
    // Firebase ID tokens do not contain role, phone, or restaurantId.
    // Always read from Firestore for complete user data.

    const userSnap = await getDoc(doc(db, "users", uid));

    if (!userSnap.exists()) {
      return NextResponse.json({
        authenticated: true,
        user: {
          uid,
          id:    uid,
          email: null,
          name:  "",
          role:  "customer",
          phone: null,
        },
      });
    }

    const profile = userSnap.data() ?? {};

    return NextResponse.json({
      authenticated: true,
      user: {
        uid,
        id:    uid,
        email: (profile.email as string)  ?? null,
        name:  (profile.name  as string)  ?? "",
        role:  (profile.role  as string)  ?? "customer",
        phone: (profile.phone as string)  ?? null,
      },
    });

  } catch (error) {
    console.error("Session verify error:", error);
    return NextResponse.json({ authenticated: false, user: null });
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRequest(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRequest(req);
}