// src/app/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter }                   from "next/navigation";
import { motion }                      from "framer-motion";
import { Coffee, MapPin }              from "lucide-react";

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
  const timerRef                    = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    fetch("/api/restaurant")
      .then((r) => r.json())
      .then((d) => setRestaurant(d.restaurant ?? null))
      .catch(() => {});

    // Exit animation at 2.5s → navigate at 3.5s
    timerRef.current = setTimeout(() => {
      setExiting(true);
      setTimeout(() => router.push("/menu"), 1000);
    }, 2500);

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
    <div className="min-h-screen relative overflow-hidden bg-[#faf6f1]">

      {/* ── Ambient Background ── */}
      <div className="absolute inset-0">
        {/* Warm gradient base */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-orange-50/80 to-rose-50" />

        {/* Large ambient orbs — slow movement */}
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{
            top:        "10%",
            left:       "50%",
            x:          "-50%",
            background: "radial-gradient(circle, rgba(251,146,60,0.08) 0%, transparent 70%)",
          }}
          animate={{
            scale:   [1, 1.2, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{
            bottom:     "20%",
            right:      "-10%",
            background: "radial-gradient(circle, rgba(217,119,6,0.06) 0%, transparent 70%)",
          }}
          animate={{
            scale:   [1, 1.15, 1],
            opacity: [0.3, 0.6, 0.3],
            x:       [0, -20, 0],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />

        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            top:        "40%",
            left:       "-5%",
            background: "radial-gradient(circle, rgba(245,158,11,0.05) 0%, transparent 70%)",
          }}
          animate={{
            scale:   [1, 1.1, 1],
            opacity: [0.4, 0.7, 0.4],
            y:       [0, 15, 0],
          }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />

        {/* Floating food elements — visible but subtle */}
        <div className="absolute inset-0 overflow-hidden">
          {[
            { emoji: "☕", x: "15%", y: "20%", size: "text-4xl", delay: 0,   dur: 5 },
            { emoji: "🥐", x: "80%", y: "15%", size: "text-3xl", delay: 0.5, dur: 6 },
            { emoji: "🍰", x: "10%", y: "70%", size: "text-3xl", delay: 1,   dur: 7 },
            { emoji: "🧁", x: "85%", y: "65%", size: "text-2xl", delay: 1.5, dur: 5.5 },
            { emoji: "🍪", x: "25%", y: "45%", size: "text-2xl", delay: 0.8, dur: 6.5 },
            { emoji: "🥤", x: "70%", y: "40%", size: "text-3xl", delay: 0.3, dur: 5.8 },
            { emoji: "🫖", x: "50%", y: "80%", size: "text-2xl", delay: 1.2, dur: 7.2 },
            { emoji: "🧇", x: "90%", y: "85%", size: "text-2xl", delay: 0.7, dur: 6.3 },
          ].map((item, i) => (
            <motion.div
              key={i}
              className={`absolute ${item.size} select-none`}
              style={{ left: item.x, top: item.y }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{
                opacity: exiting ? 0 : [0, 0.35, 0.35, 0],
                scale:   exiting ? 0.3 : [0.5, 1, 1, 0.5],
                y:       [0, -15, -15, 0],
                rotate:  [0, i % 2 === 0 ? 8 : -8, 0],
              }}
              transition={{
                duration: item.dur,
                repeat:   Infinity,
                delay:    item.delay,
                ease:     "easeInOut",
              }}
            >
              {item.emoji}
            </motion.div>
          ))}
        </div>

        {/* Soft center vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(250,246,241,0.6)_100%)]" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">

        {/* Top badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: exiting ? 0 : 1, y: exiting ? -10 : 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2.5 bg-white/70 backdrop-blur-sm border border-amber-200/50 rounded-full px-5 py-2 shadow-sm shadow-orange-100/50">
            <motion.span
              className="w-2 h-2 rounded-full bg-orange-400"
              animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[10px] font-bold text-amber-700/70 uppercase tracking-[0.25em]">
              Scan • Order • Enjoy
            </span>
          </div>
        </motion.div>

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{
            opacity: exiting ? 0 : 1,
            scale:   exiting ? 1.15 : 1,
            y:       exiting ? -30 : 0,
          }}
          transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {isLoading ? (
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-orange-100/50 animate-pulse" />
          ) : logo ? (
            <div className="relative group">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden shadow-xl shadow-orange-200/40 border-[3px] border-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt={name} className="w-full h-full object-cover" />
              </div>
              {/* Soft glow */}
              <div className="absolute inset-0 rounded-3xl bg-orange-300/10 blur-2xl -z-10 scale-150" />
              {/* Shine animation */}
              <motion.div
                className="absolute inset-0 rounded-3xl overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                  animate={{ x: ["-200%", "200%"] }}
                  transition={{ delay: 1.5, duration: 1.2, ease: "easeInOut" }}
                />
              </motion.div>
            </div>
          ) : (
            <div className="relative">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-xl shadow-orange-200/40 flex items-center justify-center border-[3px] border-white">
                <Coffee className="w-14 h-14 text-white drop-shadow-md" />
              </div>
              <div className="absolute inset-0 rounded-3xl bg-orange-300/15 blur-2xl -z-10 scale-150" />
            </div>
          )}
        </motion.div>

        {/* Decorative divider */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: exiting ? 0 : 1, opacity: exiting ? 0 : 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="flex items-center gap-3 mt-8 mb-5"
        >
          <div className="w-10 h-[1px] bg-gradient-to-r from-transparent to-amber-300/50" />
          <Coffee className="w-3 h-3 text-amber-400/40" />
          <div className="w-10 h-[1px] bg-gradient-to-l from-transparent to-amber-300/50" />
        </motion.div>

        {/* Restaurant Name — letter by letter reveal */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: exiting ? 0 : 1, y: exiting ? -15 : 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center"
        >
          <span className="text-4xl sm:text-5xl font-black text-slate-800 tracking-tight leading-none">
            {name.split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
                animate={{
                  opacity: exiting ? 0 : 1,
                  y:       0,
                  filter:  "blur(0px)",
                }}
                transition={{
                  delay:    0.6 + i * 0.04,
                  duration: 0.4,
                  ease:     "easeOut",
                }}
                className="inline-block"
              >
                {char === " " ? "\u00A0" : char}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: exiting ? 0 : 1, y: exiting ? -5 : 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-amber-700/40 text-xs sm:text-sm mt-3 text-center font-semibold tracking-[0.2em] uppercase"
        >
          {tagline}
        </motion.p>

        {/* Address */}
        {address && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: exiting ? 0 : 1 }}
            transition={{ delay: 1.2 }}
            className="flex items-center gap-1.5 mt-4 bg-white/50 backdrop-blur-sm rounded-full px-4 py-1.5 border border-amber-100/80"
          >
            <MapPin className="w-3 h-3 text-amber-500/50" />
            <p className="text-[11px] text-slate-500/60 font-medium">{address}</p>
          </motion.div>
        )}

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: exiting ? 0 : 1 }}
          transition={{ delay: 1.4 }}
          className="mt-12 flex flex-col items-center gap-3"
        >
          <div className="w-32 h-[2px] bg-amber-200/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ delay: 0.5, duration: 2.5, ease: "linear" }}
              className="h-full rounded-full bg-gradient-to-r from-orange-300 to-amber-400"
            />
          </div>
          <p className="text-[10px] text-amber-400/30 font-medium tracking-wider">
            Loading menu...
          </p>
        </motion.div>
      </div>

      {/* ── Exit Transition ── */}
      {exiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          className="absolute inset-0 z-30 bg-[#faf6f1]"
        />
      )}
    </div>
  );
}