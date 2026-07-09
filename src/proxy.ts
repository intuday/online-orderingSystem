import { NextRequest, NextResponse } from "next/server";
import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ Root → splash → /menu already handle ho raha hai page.tsx mein

  // ✅ Admin login redirect
  if (pathname === "/admin/login") {
    const token = req.cookies.get("admin-token")?.value || req.cookies.get("auth-token")?.value;
    if (token) {
      try {
        const d = verify(token, JWT_SECRET) as any;
        if (d.role === "admin" || d.role === "super_admin") {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
      } catch {}
    }
    return NextResponse.next();
  }

  // ✅ Admin routes protect
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const token = req.cookies.get("admin-token")?.value || req.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL(`/login?redirect=${pathname}`, req.url));
    }
    try {
      const d = verify(token, JWT_SECRET) as any;
      if (d.role !== "admin" && d.role !== "super_admin") {
        return NextResponse.redirect(new URL("/menu", req.url));
      }
      return NextResponse.next();
    } catch {
      const res = NextResponse.redirect(new URL(`/login?redirect=${pathname}`, req.url));
      res.cookies.delete("admin-token");
      res.cookies.delete("auth-token");
      return res;
    }
  }

  // ✅ Login/Signup - already logged in redirect
  if (pathname === "/login" || pathname === "/signup") {
    const token = req.cookies.get("auth-token")?.value;
    if (token) {
      try {
        const d    = verify(token, JWT_SECRET) as any;
        const redir = req.nextUrl.searchParams.get("redirect");
        if (redir) return NextResponse.redirect(new URL(redir, req.url));
        if (d.role === "admin" || d.role === "super_admin") {
          return NextResponse.redirect(new URL("/admin", req.url));
        }
        return NextResponse.redirect(new URL("/menu", req.url));
      } catch {}
    }
    return NextResponse.next();
  }

  // ✅ Profile page - login required
  if (pathname === "/profile") {
    const token = req.cookies.get("auth-token")?.value;
    if (!token) {
      return NextResponse.redirect(new URL("/login?redirect=/profile", req.url));
    }
    try {
      verify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      return NextResponse.redirect(new URL("/login?redirect=/profile", req.url));
    }
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