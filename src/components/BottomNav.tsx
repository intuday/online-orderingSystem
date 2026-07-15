// src/components/BottomNav.tsx
"use client";

import { usePathname } from "next/navigation";
import Link            from "next/link";
import { motion }      from "framer-motion";
import {
  Home, UtensilsCrossed, ShoppingBag, User,
} from "lucide-react";

// ─── Config ───────────────────────────────────────────────────────────────────

const navItems = [
  { href: "/",        icon: Home,            label: "Home"    },
  { href: "/menu",    icon: UtensilsCrossed, label: "Menu"    },
  { href: "/orders",  icon: ShoppingBag,     label: "Orders"  },
  { href: "/profile", icon: User,            label: "Profile" },
] as const;

// Paths where BottomNav should not be rendered
const HIDDEN_PREFIXES = [
  "/admin",
  "/orders/",  // Individual order tracking page — fixed from /order/
  "/login",
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function BottomNav() {
  const pathname = usePathname();

  // Hide on specified routes
  if (HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
      <nav
        aria-label="Bottom Navigation"
        className="pointer-events-auto mx-auto w-full max-w-md"
      >
        <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-[0_10px_35px_rgba(15,23,42,0.10),0_2px_10px_rgba(15,23,42,0.06)] backdrop-blur-2xl supports-backdrop-filter:bg-white/75">

          {/* Subtle top highlight */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80" />

          {/* Soft inner glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.65),transparent_42%)]" />

          <div className="relative grid h-[72px] grid-cols-4 items-center px-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className="group relative flex h-full items-center justify-center"
                >
                  <motion.div
                    whileTap={{ scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className="relative flex min-w-[64px] flex-col items-center justify-center gap-1.5"
                  >
                    {isActive && (
                      <>
                        <motion.div
                          layoutId="bottomNavActiveGlow"
                          className="absolute left-1/2 top-1/2 h-[54px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-[18px] bg-orange-500/5 blur-lg"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                        <motion.div
                          layoutId="bottomNavActivePill"
                          className="absolute left-1/2 top-1/2 h-[64px] w-[54px] -translate-x-1/2 -translate-y-1/2 rounded-[20px] border border-orange-200 bg-gradient-to-b from-orange-50 to-orange-100/80 shadow-[0_8px_20px_rgba(255,107,0,0.12)]"
                          transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        />
                      </>
                    )}

                    <motion.div
                      animate={{
                        y:     isActive ? -1 : 0,
                        scale: isActive ? 1.02 : 1,
                      }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-2xl transition-colors duration-200 ${
                        isActive
                          ? "text-orange-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    >
                      <item.icon
                        className={`transition-all duration-300 ${
                          isActive ? "h-[19px] w-[19px]" : "h-[18px] w-[18px]"
                        }`}
                      />
                    </motion.div>

                    <motion.span
                      animate={{
                        opacity: isActive ? 1 : 0.72,
                        y:       isActive ? 0 : 0.5,
                      }}
                      transition={{ duration: 0.2 }}
                      className={`relative z-10 text-[10px] font-semibold tracking-[0.01em] transition-colors duration-200 ${
                        isActive
                          ? "text-orange-700"
                          : "text-slate-500 group-hover:text-slate-700"
                      }`}
                    >
                      {item.label}
                    </motion.span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}