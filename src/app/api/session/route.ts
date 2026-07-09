import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("auth-token")?.value;

    if (!token) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const decoded = verify(token, JWT_SECRET) as any;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        name: decoded.name,
        role: decoded.role || "customer",
        phone: decoded.phone || null,
      },
    });
  } catch {
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}