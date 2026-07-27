// src/app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter }                   from "next/navigation";
import { motion }                      from "framer-motion";
import { MapPin, Sparkles }            from "lucide-react";

interface RestaurantData {
  name?:        string;
  description?: string;
  logo?:        string;
  address?:     string;
}

export default function HomePage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [exiting, setExiting]       = useState(false);
  const timerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/restaurant")
      .then((r) => r.json())
      .then((d) => setRestaurant(d.restaurant ?? null))
      .catch(() => {});

    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => router.push("/menu"), 1000);
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [router]);

  const isLoading = restaurant === null;
  const name      = restaurant?.name        ?? "Welcome";
  const tagline   = restaurant?.description ?? "Premium Cafe Experience";
  const logo      = restaurant?.logo        ?? "";
  const address   = restaurant?.address     ?? "";

  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-[#0a0a0f]">

      {/* ═══════════════════════════════════════════════════════════
          HERO IMAGE — Full viewport cover
          
          Animation: Starts zoomed in (1.3x) → zooms out to 1.0x
          Mobile:    object-position center — fills height, crops sides
          Desktop:   Fits naturally — minimal crop
          Exit:      Zooms back in slightly + fades
          ═══════════════════════════════════════════════════════════ */}

      {logo ? (
        <motion.div
          className="absolute inset-0 z-0"
          initial={{ scale: 2.6 }}
          animate={{
            scale:   exiting ? 1.15 : 1,
            opacity: exiting ? 0 : 1,
          }}
          transition={{
            scale: {
              duration: 3,
              ease:     [0.25, 0.1, 0.25, 1],
            },
            opacity: {
              duration: 0.8,
              ease:     "easeInOut",
            },
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt=""
            draggable={false}
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover object-center block"
          />
        </motion.div>
      ) : isLoading ? (
        /* Loading shimmer */
        <div className="absolute inset-0 z-0 bg-[#1a0e08] animate-pulse" />
      ) : (
        /* No image fallback */
        <div
          className="absolute inset-0 z-0"
          style={{
            background: "linear-gradient(135deg, #2d1810 0%, #1a0e08 50%, #0f0906 100%)",
          }}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
          OVERLAY SYSTEM — Cinematic depth + text readability
          ═══════════════════════════════════════════════════════════ */}

      {/* Main gradient — darker at bottom */}
      <div
        className="absolute inset-0 z-[2]"
        style={{
          background: `linear-gradient(
            180deg,
            rgba(0,0,0,0.25) 0%,
            rgba(0,0,0,0.10) 25%,
            rgba(0,0,0,0.20) 45%,
            rgba(0,0,0,0.50) 65%,
            rgba(0,0,0,0.80) 85%,
            rgba(0,0,0,0.90) 100%
          )`,
        }}
      />

      {/* Vignette — darkens edges */}
      <div
        className="absolute inset-0 z-[3]"
        style={{
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      {/* Subtle noise texture */}
      <div
        className="absolute inset-0 z-[4] pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:  "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize:   "28px 28px",
        }}
      />

      {/* ═══════════════════════════════════════════════════════════
          CONTENT — Bottom-aligned like premium apps
          ═══════════════════════════════════════════════════════════ */}

      <div className="relative z-10 w-full h-full flex flex-col justify-between">

        {/* ── Top bar ── */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: exiting ? 0 : 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex justify-between items-center px-5 sm:px-8"
          style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2 bg-black/25 border border-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Scan • Order • Enjoy
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-black/25 border border-white/10 backdrop-blur-md px-3 py-1.5 rounded-full">
            <Sparkles className="w-3 h-3 text-amber-400/80" />
            <span className="text-[10px] font-medium text-white/50 hidden sm:inline">
              Digital Menu
            </span>
          </div>
        </motion.div>

        {/* ── Center content block ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Decorative line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: exiting ? 0 : 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center gap-3 mb-5"
          >
            <div className="w-10 h-px bg-gradient-to-r from-transparent to-amber-400/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400/40" />
            <div className="w-10 h-px bg-gradient-to-l from-transparent to-amber-400/30" />
          </motion.div>

          {/* Restaurant Name — letter by letter reveal */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            className="text-center mb-3"
          >
            <span className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-none text-white">
              {name.split("").map((char, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.3 + i * 0.04, duration: 0.4 }}
                  className="inline-block"
                  style={{ textShadow: "0 4px 30px rgba(0,0,0,0.8)" }}
                >
                  {char === " " ? "\u00A0" : char}
                </motion.span>
              ))}
            </span>
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: exiting ? 0 : 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.4 }}
            className="text-amber-200/40 text-[11px] sm:text-xs font-semibold tracking-[0.3em] uppercase mb-4"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.5)" }}
          >
            {tagline}
          </motion.p>

          {/* Address */}
          {address && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: exiting ? 0 : 1 }}
              transition={{ delay: 1 }}
              className="flex items-center gap-1.5 bg-black/25 border border-white/10 backdrop-blur-md rounded-full px-3.5 py-1.5 mb-6"
            >
              <MapPin className="w-3 h-3 text-amber-400/50" />
              <span className="text-[10px] text-white/40 font-medium">{address}</span>
            </motion.div>
          )}

          {/* Progress bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            transition={{ delay: 1.2 }}
            className="flex flex-col items-center gap-2.5 mt-2"
          >
            <div className="w-36 h-[2px] bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ delay: 0.3, duration: 2.8, ease: "linear" }}
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400"
                style={{ boxShadow: "0 0 8px rgba(245,158,11,0.5)" }}
              />
            </div>
            <p className="text-[9px] text-white/15 font-medium tracking-[0.25em] uppercase">
              Loading Menu
            </p>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          EXIT TRANSITION
          ═══════════════════════════════════════════════════════════ */}
      {exiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 20, ease: "easeInOut" }}
          className="absolute inset-0 z-50 bg-[#0a0a0f]"
        />
      )}
    </div>
  );
}