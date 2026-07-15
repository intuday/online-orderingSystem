// src/app/admin/login/page.tsx
//
// Admin login redirects to the shared /login page with ?redirect=/admin.
// The shared login page handles both customer and admin authentication.
// After login, the admin layout verifies the role and gates access.
//
// The full standalone admin login UI (email/password + email verification)
// is preserved in git history. To restore it, revert this file and
// uncomment the full component.

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login?redirect=/admin");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
    </div>
  );
}