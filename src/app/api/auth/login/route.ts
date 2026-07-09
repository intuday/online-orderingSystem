import { NextRequest, NextResponse } from "next/server";
import { sign } from "jsonwebtoken";
import {
  adminAuth,
  db,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "@/lib/firebase-admin";

const JWT_SECRET =
  process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    let decoded: any;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const uid           = decoded.uid as string;
    const email         = (decoded.email || "") as string;
    const emailVerified = !!decoded.email_verified;
    const displayName   = (decoded.name || "") as string;

    // ✅ Firebase provider detect
    const provider = decoded.firebase?.sign_in_provider || "";

    if (!emailVerified) {
      return NextResponse.json(
        {
          error: "email_not_verified",
          message: "Please verify your email first.",
          email,
        },
        { status: 403 }
      );
    }

    let role         = "customer";
    let restaurantId = RESTAURANT_ID;
    let name         = displayName || email.split("@")[0] || "User";
    let phone        = "";

    const userRef  = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const d = userSnap.data();
      role         = d?.role || "customer";
      restaurantId = d?.restaurantId || RESTAURANT_ID;
      name         = d?.name || d?.displayName || name;
      phone        = d?.phone || "";

      await userRef.set(
        {
          lastLoginAt:   serverTimestamp(),
          emailVerified: true,
          updatedAt:     serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // backward compat: admins collection
      const adminQ = query(
        collection(db, "admins"),
        where("email", "==", email)
      );
      const adminSnap = await getDocs(adminQ);

      if (!adminSnap.empty) {
        const ad = adminSnap.docs[0].data();
        role         = ad?.role || "admin";
        restaurantId = ad?.restaurantId || RESTAURANT_ID;
        name         = ad?.name || name;
      }

      await userRef.set({
        uid,
        email,
        name,
        phone: "",
        role,
        restaurantId,
        emailVerified: true,
        totalOrders: 0,
        totalSpent: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    }

    const token = sign(
      { uid, email, role, restaurantId, name, phone },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ IMPORTANT:
    // Google login pe agar phone empty hai toh phone collect karna hi hai
    const needsPhone =
      provider === "google.com" && (!phone || phone.trim() === "");

    const loginRes = NextResponse.json({
      success: true,
      needsPhone,
      user: {
        uid,
        email,
        role,
        name,
        phone,
        restaurantId,
      },
    });

    loginRes.cookies.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    if (role === "admin" || role === "super_admin") {
      loginRes.cookies.set("admin-token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    }

    return loginRes;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}