import { NextRequest, NextResponse } from "next/server";
import { sign } from "jsonwebtoken";
import {
  adminAuth, db, doc, getDoc,
  collection, getDocs, query, where, serverTimestamp,
} from "@/lib/firebase-admin";

const JWT_SECRET    = process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";
const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    let decodedToken: any;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const uid           = (decodedToken.uid            || "") as string;
    const email         = (decodedToken.email          || "") as string;
    const emailVerified = decodedToken.email_verified as boolean;

    if (!emailVerified) {
      return NextResponse.json({
        error: "email_not_verified",
        message: "Please verify your email first.",
        email,
      }, { status: 403 });
    }

    let role         = "admin";
    let restaurantId = RESTAURANT_ID;
    let name         = email.split("@")[0] || "Admin";

    // ✅ users collection check with null guard
    const userRef  = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const d = userSnap.data() || {};
      role         = (d["role"]         as string) || "admin";
      restaurantId = (d["restaurantId"] as string) || RESTAURANT_ID;
      name         = (d["name"]         as string) || (d["displayName"] as string) || name;

      if (role !== "admin" && role !== "super_admin") {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
    } else {
      // ✅ admins collection check
      const adminQ    = query(collection(db, "admins"), where("email", "==", email));
      const adminSnap = await getDocs(adminQ);

      if (!adminSnap.empty) {
        const ad = adminSnap.docs[0].data() || {};
        role         = (ad["role"]         as string) || "admin";
        restaurantId = (ad["restaurantId"] as string) || RESTAURANT_ID;
        name         = (ad["name"]         as string) || name;
      }

      // ✅ users mein save karo
      await userRef.set({
        uid, email, name, role, restaurantId,
        emailVerified: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

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
    console.error("Admin login error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}