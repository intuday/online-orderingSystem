import { NextRequest, NextResponse } from "next/server";
import { verify, sign } from "jsonwebtoken";
import { db, doc, serverTimestamp } from "@/lib/firebase-admin";

const JWT_SECRET = process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";

export async function POST(req: NextRequest) {
  try {
    // ✅ Auth check
    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as any;
    const { name, phone } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // ✅ Firestore update
    const userRef = doc(db, "users", decoded.uid);
    await userRef.set({
      name:      name.trim(),
      phone:     phone?.trim() || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // ✅ JWT token bhi update karo (taaki cookie mein naya name aaye)
    const newToken = sign(
      {
        uid:          decoded.uid,
        email:        decoded.email,
        role:         decoded.role,
        restaurantId: decoded.restaurantId,
        name:         name.trim(),
        phone:        phone?.trim() || "",
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const response = NextResponse.json({ success: true });

    // ✅ Updated cookie
    response.cookies.set("auth-token", newToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });

    // Admin token bhi update karo
    if (decoded.role === "admin" || decoded.role === "super_admin") {
      response.cookies.set("admin-token", newToken, {
        httpOnly: true,
        secure:   process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge:   60 * 60 * 24 * 7,
        path:     "/",
      });
    }

    return response;
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}