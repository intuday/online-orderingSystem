// src/app/api/auth/login/route.ts
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

// Cookie max-age: 1 hour
// Firebase ID tokens expire in 1 hour by default.
// We store the raw Firebase ID token — not a custom JWT.
// This allows adminAuth.verifyIdToken() to validate it directly on every request.
const COOKIE_MAX_AGE = 60 * 60; // 1 hour in seconds

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    const { idToken } = body;

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json(
        { error: "Firebase ID token is required" },
        { status: 400 }
      );
    }

    // ── Verify Firebase ID Token ────────────────────────────────────────────
    // Uses Firebase Admin SDK — validates signature, expiry, and revocation.

    let decoded: DecodedIdToken;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const uid           = decoded.uid;
    const email         = decoded.email         ?? "";
    const emailVerified = decoded.email_verified ?? false;
    const displayName   = (decoded.name as string | undefined) ?? "";
    const provider      = (decoded.firebase?.sign_in_provider as string) ?? "";

    // ── Email Verification Check ────────────────────────────────────────────

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

    // ── Resolve User Profile ────────────────────────────────────────────────

    let role         = "customer";
    let restaurantId = RESTAURANT_ID;
    let name         = displayName || email.split("@")[0] || "User";
    let phone        = "";

    const userRef  = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const d      = userSnap.data() ?? {};
      role         = (d.role         as string) || "customer";
      restaurantId = (d.restaurantId as string) || RESTAURANT_ID;
      name         = (d.name         as string)
                  || (d.displayName  as string)
                  || name;
      phone        = (d.phone        as string) || "";

      // Update last login timestamp
      await setDoc(
        userRef,
        {
          lastLoginAt:   serverTimestamp(),
          emailVerified: true,
          updatedAt:     serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // ── New User: check legacy admins collection ─────────────────────────
      // TODO: Remove this block after admin migration is complete.

      const adminSnap = await getDocs(
        query(collection(db, "admins"), where("email", "==", email))
      );

      if (!adminSnap.empty) {
        const ad = adminSnap.docs[0].data();
        role         = (ad.role         as string) || "admin";
        restaurantId = (ad.restaurantId as string) || RESTAURANT_ID;
        name         = (ad.name         as string) || name;
      }

      // Create user document
      await setDoc(userRef, {
        uid,
        email,
        name,
        phone:         "",
        role,
        restaurantId,
        emailVerified: true,
        totalOrders:   0,
        totalSpent:    0,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
        lastLoginAt:   serverTimestamp(),
      });
    }

    // ── Phone Collection Flag ───────────────────────────────────────────────
    // Google sign-in does not provide phone — prompt user to add it.

    const needsPhone = provider === "google.com" && !phone.trim();

    // ── Build Response ──────────────────────────────────────────────────────

    const response = NextResponse.json({
      success: true,
      needsPhone,
      user: { uid, email, role, name, phone, restaurantId },
    });

    // Store the raw Firebase ID token in the cookie.
    // This allows API routes to verify it directly via adminAuth.verifyIdToken()
    // without needing a separate JWT secret.
    // Cookie lifetime matches Firebase ID token expiry (1 hour).
    // The client is responsible for refreshing the token and re-calling this
    // endpoint before expiry to maintain the session.

    const cookieOptions = {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    };

    response.cookies.set("auth-token", idToken, cookieOptions);

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}