// src/app/api/auth/admin-verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "restaurant-saas-super-secret-jwt-key-2024";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("admin-token")?.value;

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET) as any;

    return NextResponse.json({
      valid:        true,
      uid:          decoded.uid,
      email:        decoded.email,
      role:         decoded.role,
      name:         decoded.name,
      restaurantId: decoded.restaurantId,
    });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}