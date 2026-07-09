// src/app/api/admin/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-key-change-this";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const decoded = verify(token, JWT_SECRET);
    return NextResponse.json({ valid: true, user: decoded });
  } catch {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
}