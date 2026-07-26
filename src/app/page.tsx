// src/app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter }           from "next/navigation";
import { motion }              from "framer-motion";
import { Coffee, MapPin }      from "lucide-react";

interface RestaurantData {
  name?:        string;
  description?: string;
  logo?:        string;
  address?:     string;
}

export default function HomePage() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);

  useEffect(() => {
    fetch("/api/restaurant")
      .then((r) => r.json())
      .then((d) => setRestaurant(d.restaurant ?? null))
      .catch(() => {});

    const timer = setTimeout(() => {
      router.push("/menu");
    }, 3000);
    return () => clearTimeout(timer);
  }, [router]);

  const name    = restaurant?.name        ?? "Welcome";
  const tagline = restaurant?.description ?? "Premium Cafe Experience";
  const logo    = restaurant?.logo        ?? "";
  const address = restaurant?.address     ?? "";

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0f0906]">

      {/* ── Background Food Collage ── */}
      <div className="absolute inset-0">
        {/* Food images grid — blurred background */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 opacity-20">
          {[
            "🍔", "☕", "🥐",
            "🍕", "🧁", "🥤",
            "🍰", "🍳", "🥗",
          ].map((emoji, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="flex items-center justify-center text-5xl sm:text-6xl"
              style={{ filter: "blur(1px)" }}
            >
              {emoji}
            </motion.div>
          ))}
        </div>

        {/* Dark overlay layers */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f0906] via-[#0f0906]/85 to-[#0f0906]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0906] via-transparent to-[#0f0906]/90" />

        {/* Warm ambient glow */}
        <motion.div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(251,146,60,0.08) 0%, transparent 70%)",
          }}
          animate={{
            scale:   [1, 1.1, 1],
            opacity: [0.5, 0.8, 0.5],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Coffee steam particles */}
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={`steam-${i}`}
            className="absolute rounded-full bg-orange-300/5"
            style={{
              width:  `${8 + i * 4}px`,
              height: `${8 + i * 4}px`,
              left:   `${40 + i * 5}%`,
              bottom: "35%",
            }}
            animate={{
              y:       [0, -80 - i * 20, -160],
              x:       [0, (i % 2 === 0 ? 10 : -10), 0],
              opacity: [0, 0.4, 0],
              scale:   [0.5, 1.5, 2],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat:   Infinity,
              ease:     "easeOut",
              delay:    i * 0.8,
            }}
          />
        ))}
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">

        {/* Top decorative badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-400/20 rounded-full px-4 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[10px] font-bold text-orange-300/70 uppercase tracking-[0.2em]">
              Scan • Order • Enjoy
            </span>
          </div>
        </motion.div>

        {/* Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.3 }}
        >
          {logo ? (
            <div className="relative">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[28px] overflow-hidden shadow-2xl shadow-orange-900/40 border-2 border-orange-400/15">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt={name} className="w-full h-full object-cover" />
              </div>
              {/* Glow behind logo */}
              <div className="absolute inset-0 rounded-[28px] bg-orange-400/10 blur-2xl -z-10 scale-125" />
            </div>
          ) : (
            <div className="relative">
              <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-[28px] bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 shadow-2xl shadow-orange-900/40 flex items-center justify-center border-2 border-orange-300/20">
                <Coffee className="w-16 h-16 text-white/90 drop-shadow-lg" />
              </div>
              <div className="absolute inset-0 rounded-[28px] bg-orange-500/15 blur-2xl -z-10 scale-125" />
            </div>
          )}
        </motion.div>

        {/* Decorative divider */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex items-center gap-3 mt-8 mb-6"
        >
          <div className="w-8 h-px bg-gradient-to-r from-transparent to-orange-400/40" />
          <div className="w-2 h-2 rounded-full bg-orange-400/30 border border-orange-400/20" />
          <div className="w-8 h-px bg-gradient-to-l from-transparent to-orange-400/40" />
        </motion.div>

        {/* Restaurant Name */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-4xl sm:text-5xl font-black text-white text-center tracking-tight leading-none"
          style={{ textShadow: "0 4px 30px rgba(251,146,60,0.15), 0 2px 10px rgba(0,0,0,0.5)" }}
        >
          {name}
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="text-orange-200/50 text-sm sm:text-base mt-3 text-center font-medium tracking-widest uppercase"
          style={{ letterSpacing: "0.15em" }}
        >
          {tagline}
        </motion.p>

        {/* Address */}
        {address && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 }}
            className="flex items-center gap-1.5 mt-4"
          >
            <MapPin className="w-3 h-3 text-orange-400/30" />
            <p className="text-[11px] text-orange-300/25 font-medium">
              {address}
            </p>
          </motion.div>
        )}

        {/* Loading animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="mt-14 flex flex-col items-center gap-4"
        >
          {/* Animated dots loader */}
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-2 h-2 rounded-full bg-orange-400"
                animate={{
                  scale:   [1, 1.5, 1],
                  opacity: [0.3, 1, 0.3],
                }}
                transition={{
                  duration: 1,
                  repeat:   Infinity,
                  delay:    i * 0.2,
                  ease:     "easeInOut",
                }}
              />
            ))}
          </div>
          <p className="text-[11px] text-orange-300/20 font-medium">
            Loading menu...
          </p>
        </motion.div>

        {/* Bottom decorative element */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-6 left-0 right-0 flex justify-center"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-orange-400/10" />
            <Coffee className="w-3.5 h-3.5 text-orange-400/15" />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-orange-400/10" />
          </div>
        </motion.div>
      </div>
    </div>
  );
}