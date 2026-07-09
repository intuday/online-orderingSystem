import { NextRequest, NextResponse } from "next/server";
import { sign } from "jsonwebtoken";
import {
  adminAuth, db, doc, getDoc,
  collection, getDocs, query, where, serverTimestamp,
} from "@/lib/firebase-admin";

const JWT_SECRET     = process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";
const RESTAURANT_ID  = process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // ✅ Firebase token verify
    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const uid            = decodedToken.uid            as string;
    const email          = decodedToken.email          as string;
    const email_verified = decodedToken.email_verified as boolean;

    // ✅ Email check
    if (!email_verified) {
      return NextResponse.json({
        error:   "email_not_verified",
        message: "Please verify your email first.",
        email,
      }, { status: 403 });
    }

    let role         = "admin";
    let restaurantId = RESTAURANT_ID;
    let name         = email.split("@")[0] || "Admin";

    // ✅ Check users collection
    const userRef  = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const d  = userSnap.data();
      role         = d?.role         || "admin";
      restaurantId = d?.restaurantId || RESTAURANT_ID;
      name         = d?.name         || d?.displayName || name;

      if (role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    } else {
      // ✅ Check admins collection
      const adminQ    = query(collection(db, "admins"), where("email", "==", email));
      const adminSnap = await getDocs(adminQ);

      if (!adminSnap.empty) {
        const d  = adminSnap.docs[0].data();
        role         = d?.role         || "admin";
        restaurantId = d?.restaurantId || RESTAURANT_ID;
        name         = d?.name         || name;
      }

      // ✅ users mein save karo
      await userRef.set({
        uid, email, name, role, restaurantId,
        emailVerified: true,
        createdAt:     serverTimestamp(),
        updatedAt:     serverTimestamp(),
      });
    }

    // ✅ JWT
    const token = sign(
      { uid, email, role, restaurantId, name },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({ success: true, email, role, name, restaurantId });

    response.cookies.set("admin-token", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}