import { NextRequest, NextResponse } from "next/server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Firebase ID token check — sirf presence aur basic format check karta hai.
 * Full verification server-side API routes mein hoti hai (adminAuth.verifyIdToken).
 * Middleware mein Firebase Admin SDK use nahi kar sakte — Edge runtime support nahi.
 */
function hasValidTokenFormat(token: string | undefined): boolean {
  if (!token) return false;
  // JWT format: 3 parts separated by dots
  const parts = token.split(".");
  return parts.length === 3;
}

/**
 * Token se role nikalna — Firebase ID token ka payload base64 decode karke.
 * Ye cryptographic verification nahi hai — sirf role check ke liye hai.
 * Real security API routes mein adminAuth.verifyIdToken() se hoti hai.
 */
function getRoleFromToken(token: string): string {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf-8")
    );
    // Custom claims se role lo (agar set hain)
    return payload.role ?? "";
  } catch {
    return "";
  }
}

// ─── Proxy / Middleware ───────────────────────────────────────────────────────

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const authToken  = req.cookies.get("auth-token")?.value;
  const hasToken   = hasValidTokenFormat(authToken);

  // ── Admin login page ──────────────────────────────────────────────────────
  if (pathname === "/admin/login") {
    if (hasToken) {
      const role = getRoleFromToken(authToken!);
      if (role === "admin" || role === "super_admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }
    return NextResponse.next();
  }

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();

    if (!hasToken) {
      return NextResponse.redirect(new URL(`/login?redirect=${pathname}`, req.url));
    }

    const role = getRoleFromToken(authToken!);
    if (role === "admin" || role === "super_admin") {
      return NextResponse.next();
    }

    // Token hai lekin role nahi pata (Firebase token without custom claims)
    // API route pe jaane do — wahan proper verification hogi
    // Agar role nahi milta toh admin layout khud redirect karega
    return NextResponse.next();
  }

  // ── Login / Signup page ───────────────────────────────────────────────────
  if (pathname === "/login" || pathname === "/signup") {
    if (hasToken) {
      // Token present hai — already logged in
      // Redirect param dekho
      const redir = req.nextUrl.searchParams.get("redirect");
      if (redir && redir !== "/login" && redir !== "/signup") {
        return NextResponse.redirect(new URL(redir, req.url));
      }
      // Role check karo for admin redirect
      const role = getRoleFromToken(authToken!);
      if (role === "admin" || role === "super_admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.redirect(new URL("/menu", req.url));
    }
    return NextResponse.next();
  }

  // ── Profile page ──────────────────────────────────────────────────────────
  if (pathname === "/profile") {
    if (!hasToken) {
      return NextResponse.redirect(new URL("/login?redirect=/profile", req.url));
    }
    // Token present — aage jaane do, profile page khud verify karega
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/login",
    "/signup",
    "/profile",
  ],
};