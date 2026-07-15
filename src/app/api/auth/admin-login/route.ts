// src/app/api/auth/admin-login/route.ts
//
// Admin-specific login. Verifies Firebase ID token, checks user has admin/super_admin role,
// then stores the Firebase ID token in auth-token cookie (same as regular login).
// No custom JWT — Firebase ID token is used directly for all subsequent API calls.

import { NextRequest, NextResponse }  from "next/server";
import type { DecodedIdToken }        from "firebase-admin/auth";
import {
  adminAuth, db,
  doc, getDoc, setDoc,
  collection, getDocs,
  query, where,
  serverTimestamp,
}                                     from "@/lib/firebase-admin";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const COOKIE_MAX_AGE = 60 * 60; // 1 hour — matches Firebase ID token expiry

const ADMIN_ROLES = ["admin", "super_admin"] as const;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body    = await req.json() as Record<string, unknown>;
    const idToken = body.idToken;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Firebase ID token is required" },
        { status: 400 }
      );
    }

    // ── Verify Firebase ID Token ────────────────────────────────────────────

    let decoded: DecodedIdToken;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const uid            = decoded.uid;
    const email          = decoded.email          ?? "";
    const emailVerified  = decoded.email_verified ?? false;

    // ── Email Verification ──────────────────────────────────────────────────

    if (!emailVerified) {
      return NextResponse.json(
        {
          error:   "email_not_verified",
          message: "Please verify your email before logging in.",
          email,
        },
        { status: 403 }
      );
    }

    // ── Resolve Admin Profile ───────────────────────────────────────────────

    let role         = "admin";
    let restaurantId = RESTAURANT_ID;
    let name         = email.split("@")[0] || "Admin";

    const userRef  = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const d      = userSnap.data() ?? {};
      role         = (d.role         as string) || "admin";
      restaurantId = (d.restaurantId as string) || RESTAURANT_ID;
      name         = (d.name         as string)
                  || (d.displayName  as string)
                  || name;

      // Only admin and super_admin can use this endpoint
      if (!ADMIN_ROLES.includes(role as typeof ADMIN_ROLES[number])) {
        return NextResponse.json(
          { error: "Access denied. Admin privileges required." },
          { status: 403 }
        );
      }

      // Update last login
      await setDoc(
        userRef,
        { lastLoginAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      );
    } else {
      // ── Legacy: check admins collection ──────────────────────────────────
      // TODO: Remove after admin migration is complete.

      const adminSnap = await getDocs(
        query(collection(db, "admins"), where("email", "==", email))
      );

      if (!adminSnap.empty) {
        const d      = adminSnap.docs[0].data();
        role         = (d.role         as string) || "admin";
        restaurantId = (d.restaurantId as string) || RESTAURANT_ID;
        name         = (d.name         as string) || name;
      }

      // Create user document for new admin
      await setDoc(userRef, {
        uid,
        email,
        name,
        role,
        restaurantId,
        emailVerified:  true,
        totalOrders:    0,
        totalSpent:     0,
        createdAt:      serverTimestamp(),
        updatedAt:      serverTimestamp(),
        lastLoginAt:    serverTimestamp(),
      });
    }

    // ── Store Firebase ID Token in Cookie ───────────────────────────────────
    // No custom JWT — Firebase ID token is stored directly.
    // API routes verify it via adminAuth.verifyIdToken().

    const response = NextResponse.json({
      success:      true,
      email,
      role,
      name,
      restaurantId,
    });

    response.cookies.set("auth-token", idToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    });

    return response;

  } catch (error) {
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}