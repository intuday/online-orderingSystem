// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  // Clear auth-token with the same options it was set with.
  // Path must match exactly for browsers to clear the cookie correctly.
  // maxAge: 0 instructs the browser to delete the cookie immediately.
  const clearOptions = {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge:   0,
    path:     "/",
  };

  response.cookies.set("auth-token", "", clearOptions);

  return response;
}