// src/app/admin/layout.tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import Link                                     from "next/link";
import { usePathname, useRouter }               from "next/navigation";
import { motion, AnimatePresence }              from "framer-motion";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Grid3X3,
  Ticket, Users, BarChart3, Settings, Menu, X,
  ChevronRight, ImageIcon, LogOut, TableProperties,
} from "lucide-react";

// ─── Navigation Config ────────────────────────────────────────────────────────

const navItems = [
  { href: "/admin",            label: "Dashboard",   icon: LayoutDashboard,  exact: true },
  { href: "/admin/orders",     label: "Orders",      icon: ShoppingBag },
  { href: "/admin/menu",       label: "Menu Items",  icon: UtensilsCrossed },
  { href: "/admin/categories", label: "Categories",  icon: Grid3X3 },
  { href: "/admin/tables",     label: "Tables & QR", icon: TableProperties },
  { href: "/admin/offers",     label: "Offers",      icon: ImageIcon },
  { href: "/admin/coupons",    label: "Coupons",     icon: Ticket },
  { href: "/admin/customers",  label: "Customers",   icon: Users },
  { href: "/admin/reports",    label: "Reports",     icon: BarChart3 },
  { href: "/admin/settings",   label: "Settings",    icon: Settings },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  email:        string;
  role:         string;
  name:         string;
  restaurantId: string;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser]     = useState<AdminUser | null>(null);
  const [verified, setVerified]       = useState(false);
  const [checking, setChecking]       = useState(true);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      setVerified(true);
      return;
    }

    fetch("/api/auth/verify-status")
      .then((res) => res.json())
      .then((data) => {
        if (
          data.authenticated &&
          (data.user.role === "admin" || data.user.role === "super_admin")
        ) {
          setAdminUser({
            email:        data.user.email        ?? "",
            role:         data.user.role         ?? "admin",
            name:         data.user.name         || data.user.email || "Admin",
            restaurantId: data.user.restaurantId ?? "",
          });
          setVerified(true);
        } else {
          router.replace("/login?redirect=/admin");
        }
      })
      .catch(() => router.replace("/login?redirect=/admin"))
      .finally(() => setChecking(false));

  }, [isLoginPage, router]);

  const handleLogout = async () => {
    try {
      const { auth, signOut } = await import("@/lib/firebase");
      await signOut(auth);
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore — proceed with redirect regardless
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!verified) return null;
  if (isLoginPage) return <>{children}</>;

  return (
    <div className="min-h-screen bg-[#f8f9fb]">

      {/* ── Mobile Header ── */}
      <header className="lg:hidden sticky top-0 z-50 h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center"
        >
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <h1 className="text-base font-bold text-slate-900 flex-1">Admin Panel</h1>
        <button
          onClick={handleLogout}
          className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center"
          title="Logout"
        >
          <LogOut className="w-4 h-4 text-red-600" />
        </button>
      </header>

      {/* ── Mobile Sidebar ── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          >
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-[280px] h-full bg-white shadow-2xl overflow-y-auto"
            >
              <SidebarContent
                pathname={pathname}
                adminUser={adminUser}
                onClose={() => setSidebarOpen(false)}
                onLogout={handleLogout}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 overflow-y-auto z-40">
        <SidebarContent
          pathname={pathname}
          adminUser={adminUser}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Main Content ── */}
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  adminUser,
  onClose,
  onLogout,
}: {
  pathname:  string;
  adminUser: AdminUser | null;
  onClose?:  () => void;
  onLogout:  () => void;
}) {
  const restaurantName = adminUser?.restaurantId
    ? "Admin Panel"
    : "Admin Panel";

  return (
    <div className="flex flex-col h-full">

      {/* Logo */}
      <div className="p-5 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{restaurantName}</h2>
            <p className="text-[10px] text-slate-400 capitalize">
              {adminUser?.role ?? "Admin"} Panel
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center lg:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Admin Info */}
      {adminUser && (
        <div className="px-4 py-3 bg-slate-50 mx-3 mt-3 rounded-xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {(adminUser.name || adminUser.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">
                {adminUser.name || "Admin"}
              </p>
              <p className="text-[10px] text-slate-400 truncate">{adminUser.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {navItems.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-slate-900 text-white shadow-md"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-slate-100 space-y-1">
        <Link
          href="/menu"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
          <span>View Menu</span>
        </Link>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}