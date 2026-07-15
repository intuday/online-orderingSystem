// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode }          from "react";
import { Inter }                   from "next/font/google";
import { AuthProvider }            from "@/contexts/AuthContext";
import { RestaurantProvider }      from "@/contexts/RestaurantContext";
import { BottomNav }               from "@/components/BottomNav";
import "./globals.css";

// ─── Font ─────────────────────────────────────────────────────────────────────
// next/font/google self-hosts the font — no external network request at runtime.
// Eliminates render-blocking external font link and layout shift.

const inter = Inter({
  subsets:  ["latin"],
  weight:   ["400", "500", "600", "700", "800"],
  display:  "swap",
  variable: "--font-inter",
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       "The Royal Kitchen - Premium Dining",
  description: "Scan, Order & Enjoy. Premium restaurant ordering experience.",
  manifest:    "/manifest.json",
  icons:       { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor:   "#f97316",
};

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="bg-[#fafafa] text-slate-900 antialiased font-sans">
        <AuthProvider>
          <RestaurantProvider>
            {children}
            <BottomNav />
          </RestaurantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}