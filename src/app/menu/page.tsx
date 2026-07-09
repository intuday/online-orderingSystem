"use client";

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search, ShoppingBag, Minus, Plus, Star, Clock, Flame,
  ChevronRight, X, Leaf, AlertTriangle, Sparkles, TrendingUp,
  Tag, ArrowLeft, Send, Percent, Gift, Check,
} from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useOfferEngine } from "@/store/offer-engine";
import type { CartItemForEngine } from "@/store/offer-engine";
import { formatCurrency } from "@/lib/utils";
import { MenuItemSkeleton, CategorySkeleton } from "@/components/ui/skeleton";
import type {
  MenuItem, Category, Offer, Restaurant, Variant, Addon,
} from "@/lib/firebase";
import type { OfferRule, RewardChoice } from "@/lib/types/offers";

interface MenuData {
  restaurant: Restaurant | null;
  categories: Category[];
  items:      MenuItem[];
  offers:     Offer[];
}

function menuItemToEngine(mi: MenuItem): CartItemForEngine {
  return {
    menuItemId: mi.id,
    name:       mi.name,
    price:      mi.price,
    quantity:   0,
    categoryId: mi.categoryId,
    image:      mi.image,
    isVeg:      mi.isVeg,
  };
}

function parseJson<T>(value: unknown): T {
  if (Array.isArray(value)) return value as T;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return [] as unknown as T; }
  }
  if (value !== null && typeof value === "object") return value as T;
  return [] as unknown as T;
}

export default function MenuPage() {
  const [data, setData]               = useState<MenuData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem]     = useState<MenuItem | null>(null);
  const [showCart, setShowCart]             = useState(false);
  const [selectedOffer, setSelectedOffer]   = useState<Offer | null>(null);
  const [showAllOffers, setShowAllOffers]   = useState(false);
  const [activeOfferIndex, setActiveOfferIndex] = useState(0);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  const [displayTable, setDisplayTable] = useState<string>("");
  const [qrToken, setQrToken] = useState<string>("");
  const [tableError, setTableError] = useState("");
  const [sessionCreated, setSessionCreated] = useState(false);

  const sectionRefs       = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const currentTableId = useCartStore((s) => s.tableId);
  const tableId        = useCartStore((s) => s.tableId);
  const setCustomer    = useCartStore((s) => s.setCustomer);
  const setTable       = useCartStore((s) => s.setTable);
  const getSubtotal    = useCartStore((s) => s.getSubtotal);
  const cartItems      = useCartStore((s) => s.items);
  const getItemCount   = useCartStore((s) => s.getItemCount);
  const itemCount      = getItemCount();

  const setOffers          = useOfferEngine((s) => s.setOffers);
  const setMenuItemsCache  = useOfferEngine((s) => s.setMenuItemsCache);
  const evaluateCart       = useOfferEngine((s) => s.evaluateCart);
  const showRewardSelector = useOfferEngine((s) => s.showRewardSelector);

  useEffect(() => {
    fetch("/api/auth/verify-status")
      .then((r) => r.json())
      .then((d) => {
        if (d.authenticated && d.user) {
          setCustomer(d.user.uid || "", d.user.name || "", d.user.phone || "");
        }
      })
      .catch(() => {});
  }, [setCustomer]);

  useEffect(() => {
    let lastY = 0;
    const handleScroll = () => {
      const currentY = window.scrollY;
      setIsScrolledDown(currentY > 100 && currentY > lastY);
      lastY = currentY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const table = params.get("table");
    const q = params.get("q");

    const resolve = async () => {
      if (q) {
        setQrToken(q);
        try {
          const res = await fetch("/api/qr/resolve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: q }),
          });
          const responseData = await res.json();
          if (res.ok && responseData.valid && responseData.table) {
            if (responseData.table.id !== currentTableId) setTable(responseData.table.id);
            setDisplayTable(responseData.table.name || `Table ${responseData.table.number}`);
            setTableError("");
            return;
          }
          setTableError(responseData.error || "Invalid QR");
          return;
        } catch {
          setTableError("Failed to validate QR");
          return;
        }
      }
      if (table) {
        if (table !== currentTableId) setTable(table);
        setDisplayTable(`Table ${table}`);
      } else {
        setDisplayTable("");
      }
    };

    resolve();
  }, [currentTableId, setTable]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res  = await fetch("/api/menu");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setData(json);

        if (json.items?.length) {
          setMenuItemsCache((json.items as MenuItem[]).map(menuItemToEngine));
        }

        if (json.offers?.length) {
          const rules: OfferRule[] = (json.offers as any[]).map((o) => ({
            id:               o.id,
            restaurantId:     o.restaurantId     || "",
            title:            o.title            || "",
            description:      o.description      || "",
            image:            o.image            || "",
            offerType:        o.offerType        || "discount",
            discountType:     o.discountType     || "percentage",
            discountValue:    o.discountValue    || 0,
            condition: o.condition || {
              requiredItemIds: [],
              requiredCategoryIds: [],
              minQuantity: 1,
              matchType: "any" as const,
            },
            reward: o.reward || {
              rewardItemIds: [],
              promoPrice: 0,
              maxQuantity: 1,
              autoAdd: false,
            },
            comboItems:       o.comboItems       || [],
            comboPrice:       o.comboPrice       ?? null,
            isActive:         o.isActive !== false,
            priority:         o.priority         || 0,
            maxUsagePerOrder: o.maxUsagePerOrder || 1,
            validFrom:        o.validFrom        || null,
            validTo:          o.validTo          || null,
          }));
          setOffers(rules);
        }
      } catch (err) { console.error("Menu fetch error:", err); }
      finally { setLoading(false); }
    })();
  }, [setOffers, setMenuItemsCache]);
  useEffect(() => {
  if (!data?.offers?.length) return;
  setActiveOfferIndex((prev) => (prev >= data.offers.length ? 0 : prev));
}, [data?.offers?.length]);

useEffect(() => {
  if (search) return;
  if (!data?.offers?.length || data.offers.length <= 1) return;

  const interval = window.setInterval(() => {
    setActiveOfferIndex((prev) => (prev + 1) % data.offers.length);
  }, 3000);

  return () => window.clearInterval(interval);
}, [data?.offers?.length, search]);

  useEffect(() => {
    const createSession = async () => {
      if (!tableId || sessionCreated) return;
      try {
        const authRes = await fetch("/api/auth/verify-status", { cache: "no-store" });
        const authData = await authRes.json();
        if (!authData.authenticated) return;
        const payload = qrToken
          ? { qrToken }
          : {
              tableId,
              restaurantId: process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001",
            };
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const sessionData = await res.json();
        if (res.ok) {
          setSessionCreated(true);
          setTableError("");
        } else if (res.status === 409) {
          setTableError(sessionData.message || "This table is already in use.");
        }
      } catch {
        // ignore for browsing
      }
    };
    if (tableId && !loading) {
      createSession();
    }
  }, [tableId, qrToken, loading, sessionCreated]);

  useEffect(() => {
    if (!data?.items?.length) return;
    const menuForEngine  = data.items.map(menuItemToEngine);
    const cartForEngine: CartItemForEngine[] = cartItems.map((ci) => {
      const mi = data.items.find((m) => m.id === ci.menuItemId);
      return {
        menuItemId:    ci.menuItemId,
        name:          ci.name,
        price:         ci.price,
        quantity:      ci.quantity,
        categoryId:    mi?.categoryId,
        image:         ci.image,
        isVeg:         mi?.isVeg,
        isPromotional: false,
      };
    });
    evaluateCart(cartForEngine, menuForEngine);
  }, [cartItems, data?.items, evaluateCart]);

  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 140,
        behavior: "smooth",
      });
    }
  }, []);

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    if (!search) return data.items;
    const q = search.toLowerCase();
    return data.items.filter((i) =>
      i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)
    );
  }, [data, search]);

  const itemsByCategory = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    (data?.categories || []).forEach((c) => {
      map[c.id] = filteredItems.filter((i) => i.categoryId === c.id);
    });
    return map;
  }, [data, filteredItems]);

  const recommended  = useMemo(() => filteredItems.filter((i) => i.isRecommended), [filteredItems]);
  const popular      = useMemo(() => filteredItems.filter((i) => i.isPopular), [filteredItems]);
  const todaySpecial = useMemo(() => filteredItems.filter((i) => i.isTodaySpecial), [filteredItems]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] pb-24">
        <div className="sticky top-0 z-30 bg-white shadow-sm px-4 sm:px-6 lg:px-8 py-4">
          <div className="max-w-7xl mx-auto space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <div className="animate-pulse h-5 w-32 rounded-lg bg-slate-200" />
                <div className="animate-pulse h-3.5 w-20 rounded-lg bg-slate-100" />
              </div>
              <div className="animate-pulse h-10 w-10 rounded-2xl bg-slate-200" />
            </div>
            <div className="animate-pulse h-12 w-full rounded-2xl bg-slate-100" />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 overflow-x-auto py-4 hide-scrollbar">
            {Array.from({ length: 6 }).map((_, i) => <CategorySkeleton key={i} />)}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <MenuItemSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }
  const activeOffer = data?.offers?.[activeOfferIndex] || null;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3">
          <div className="space-y-3 lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-center lg:gap-4 lg:space-y-0">
            <div className="flex items-center justify-between lg:pr-2">
              <div className="flex min-w-0 flex-col">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-500">
                    {displayTable || "Menu"}
                  </span>
                </div>
                <h1 className="mt-0.5 truncate text-[18px] font-black leading-tight text-slate-900 sm:text-[20px]">
                  {data?.restaurant?.name || "Restaurant"}
                </h1>
              </div>

              <div className="flex items-center gap-2.5">
                {displayTable && (
                  <div className="flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2">
                    <span className="text-[11px] font-bold text-orange-600">{displayTable}</span>
                  </div>
                )}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowCart(true)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                >
                  <ShoppingBag className="h-5 w-5" />
                  <AnimatePresence>
                    {itemCount > 0 && (
                      <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white shadow-md"
                      >
                        {itemCount}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative"
            >
              <div className="absolute left-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-orange-100">
                <Search className="h-3 w-3 text-orange-500" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for dishes, cuisines..."
                className="h-12 w-full rounded-2xl bg-[#F5F5F5] pl-11 pr-10 text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200"
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200"
                  >
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {tableError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{tableError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">        {/* ── Premium Offer Carousel ── */}
        {!search && data?.offers && data.offers.length > 0 && activeOffer && (
          <div className="px-4 pt-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
              <div
                className="relative overflow-hidden rounded-[24px]"
                style={{ boxShadow: "0 8px 32px rgba(255,107,0,0.15)" }}
              >
                {/* Slide */}
                <div className="relative h-[180px] sm:h-[200px] lg:h-[220px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeOffer.id}
                      initial={{ opacity: 0, scale: 1.02 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      onClick={() => setSelectedOffer(activeOffer)}
                      className="absolute inset-0 cursor-pointer"
                    >
                      {/* Background */}
                      {activeOffer.image ? (
                        <img
                          src={activeOffer.image}
                          alt={activeOffer.title}
                          className="h-full w-full object-cover"
                        /> /* eslint-disable-line */
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-orange-500 via-orange-400 to-red-500" />
                      )}

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/20" />
                    </motion.div>
                  </AnimatePresence>

                  {/* Content Layer */}
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-5">

                    {/* Top Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-1 shadow-lg">
                        <Percent className="h-3 w-3 text-white" />
                        <span className="text-[9px] font-black uppercase tracking-wider text-white">
                          Special Offer
                        </span>
                      </div>

                      {data.offers.length > 1 && (
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                            {activeOfferIndex + 1} / {data.offers.length}
                          </span>
                          <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAllOffers(true);
                            }}
                            className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                          >
                            All <ChevronRight className="h-3 w-3" />
                          </motion.button>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row */}
                    <div>
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeOffer.id + "-text"}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.35 }}
                        >
                          <h3 className="text-xl font-black leading-tight text-white drop-shadow-md sm:text-2xl lg:text-[28px]">
                            {activeOffer.title}
                          </h3>

                          {activeOffer.description && (
                            <p className="mt-1.5 line-clamp-1 max-w-[480px] text-[11px] font-medium text-white/70 sm:text-xs">
                              {activeOffer.description}
                            </p>
                          )}
                        </motion.div>
                      </AnimatePresence>

                      <div className="mt-3 flex items-center gap-3">
                        <span className="rounded-full bg-white px-3.5 py-1.5 text-[11px] font-black text-orange-600 shadow-lg sm:text-xs">
                          {activeOffer.discountValue}
                          {activeOffer.discountType === "percentage" ? "% OFF" : " ₹ OFF"}
                        </span>

                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOffer(activeOffer);
                          }}
                          className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/25 sm:text-xs"
                        >
                          View <ChevronRight className="h-3.5 w-3.5" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dots - compact bottom bar */}
                {data.offers.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-red-500 py-1">
                    {data.offers.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setActiveOfferIndex(idx)}
                        className={`rounded-full transition-all duration-300 ${
                          activeOfferIndex === idx
                            ? "h-2 w-5 bg-white"
                            : "h-2 w-2 bg-white/40 hover:bg-white/60"
                        }`}
                        aria-label={`Go to offer ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Category tabs */}
        {!search && data?.categories && (
          <div
            ref={categoryScrollRef}
            className="sticky top-[108px] z-30 bg-[#F5F5F5]/95 backdrop-blur-xl lg:top-[88px]"
          >
            <div className="flex gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8 hide-scrollbar">
              {data.categories.map((cat, idx) => (
                <motion.button
                  key={cat.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                    activeCategory === cat.id
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:border-orange-300 hover:text-orange-600 shadow-sm"
                  }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.name}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Recommended */}
        {!search && recommended.length > 0 && (
          <section className="px-4 pb-2 pt-4 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                <Sparkles className="h-4 w-4 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-black leading-none text-slate-900">Recommended</h2>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">Curated just for you</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
              {recommended.map((item, idx) => (
                <CompactCard key={item.id} item={item} index={idx} onSelect={setSelectedItem} />
              ))}
            </div>
          </section>
        )}

        {/* Popular */}
        {!search && popular.length > 0 && (
          <section className="px-4 pb-2 pt-2 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-100">
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <h2 className="text-base font-black leading-none text-slate-900">Popular</h2>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">Most ordered dishes</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
              {popular.map((item, idx) => (
                <CompactCard key={item.id} item={item} index={idx} onSelect={setSelectedItem} />
              ))}
            </div>
          </section>
        )}

        {/* Today's Special */}
        {!search && todaySpecial.length > 0 && (
          <section className="px-4 pb-2 pt-2 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100">
                <Flame className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-black leading-none text-slate-900">Today&apos;s Special</h2>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">Limited time only</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar md:grid md:grid-cols-2 md:overflow-visible xl:grid-cols-4">
              {todaySpecial.map((item, idx) => (
                <CompactCard key={item.id} item={item} index={idx} onSelect={setSelectedItem} />
              ))}
            </div>
          </section>
        )}

        {/* Menu by Category */}
        {data?.categories?.map((cat) => {
          const catItems = itemsByCategory[cat.id] || [];
          if (!catItems.length) return null;
          return (
            <section
              key={cat.id}
              ref={(el: HTMLDivElement | null) => { sectionRefs.current[cat.id] = el; }}
              className="pb-6"
            >
              <div className="flex items-center gap-3 px-4 pb-4 pt-5 sm:px-6 lg:px-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-white text-xl shadow-sm">
                  {cat.icon}
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-black text-slate-900">{cat.name}</h2>
                  <p className="text-[11px] font-medium text-slate-400">{catItems.length} items</p>
                </div>
              </div>

              <div className="mx-4 mb-4 h-px bg-slate-200/60 sm:mx-6 lg:mx-8" />

              <div className="grid grid-cols-1 gap-4 px-4 sm:px-6 md:grid-cols-2 lg:px-8 2xl:grid-cols-3">
                {catItems.map((item, idx) => (
                  <MenuItemCard key={item.id} item={item} index={idx} onSelect={setSelectedItem} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Empty search */}
        {search && filteredItems.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
              <Search className="h-9 w-9 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-700">No dishes found</h3>
            <p className="mt-2 text-sm font-medium text-slate-400">
              We couldn&apos;t find &quot;{search}&quot;.<br />Try a different keyword.
            </p>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setSearch("")}
              className="mt-6 h-11 rounded-2xl bg-orange-500 px-6 text-sm font-bold text-white shadow-lg shadow-orange-200"
            >
              Clear Search
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Floating Cart Bar */}
      <AnimatePresence>
        {itemCount > 0 && !showCart && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-none fixed inset-x-0 z-50"
            style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
          >
            <div className="max-w-7xl mx-auto flex justify-center px-4 sm:px-6 lg:justify-end lg:px-8">
              <div className="w-full max-w-[420px]">
                <motion.button
                  onClick={() => setShowCart(true)}
                  animate={{
                    width: isScrolledDown ? 60 : 420,
                    borderRadius: isScrolledDown ? 30 : 20,
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="pointer-events-auto flex h-16 items-center justify-between overflow-hidden bg-slate-900 text-white shadow-2xl shadow-slate-900/30 transition-transform active:scale-[0.98]"
                  style={{ maxWidth: "100%" }}
                >
                  <AnimatePresence mode="wait">
                    {isScrolledDown ? (
                      <motion.div
                        key="icon-only"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="relative flex h-full w-full items-center justify-center"
                      >
                        <ShoppingBag className="h-6 w-6" />
                        <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black">
                          {itemCount}
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="full-bar"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex w-full items-center justify-between px-5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <ShoppingBag className="h-6 w-6" />
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black">
                              {itemCount}
                            </span>
                          </div>
                          <div>
                            <span className="text-base font-black">
                              {itemCount} item{itemCount > 1 ? "s" : ""}
                            </span>
                            <span className="ml-1 text-xs font-medium text-slate-400">in cart</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="text-base font-black">{formatCurrency(getSubtotal())}</p>
                          </div>
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500">
                            <ChevronRight className="h-4 w-4 text-white" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedItem && <ProductSheet item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showCart && (
          <CartSheet
            menuItems={data?.items || []}
            restaurantId={data?.restaurant?.id || "a0000000-0000-0000-0000-000000000001"}
            onClose={() => setShowCart(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedOffer && (
          <OfferDetailModal
            offer={selectedOffer}
            menuItems={data?.items || []}
            onClose={() => setSelectedOffer(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAllOffers && data?.offers && (
          <AllOffersModal
            offers={data.offers}
            onClose={() => setShowAllOffers(false)}
            onSelect={(o) => { setShowAllOffers(false); setSelectedOffer(o); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showRewardSelector && <RewardPickerModal menuItems={data?.items || []} />}
      </AnimatePresence>
    </div>
  );
}

function CompactCard({ item, index, onSelect }: { item: MenuItem; index: number; onSelect: (i: MenuItem) => void }) {
  const cartItems      = useCartStore((s) => s.items);
  const addItem        = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const cartItem       = cartItems.find((ci) => ci.menuItemId === item.id);
  const variants       = parseJson<Variant[]>(item.variants);
  const hasCustomization = variants.length > 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasCustomization) { onSelect(item); return; }
    addItem({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1, image: item.image || "" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onSelect(item)}
      className="h-full min-w-0 w-40 shrink-0 cursor-pointer overflow-hidden rounded-[20px] bg-white md:w-full"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
    >
      <div className="relative h-28 overflow-hidden bg-slate-100">
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            width={160}
            height={112}
            className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-4xl">
            🍽️
          </div>
        )}

        {item.comparePrice && (
          <div className="absolute left-2 top-2">
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white shadow-md">
              {Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}% OFF
            </span>
          </div>
        )}

        {item.isFeatured && (
          <div className="absolute right-2 top-2">
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-md">
              ⭐ BEST
            </span>
          </div>
        )}

        <div className="absolute bottom-2 left-2">
          <div className={`flex h-4 w-4 items-center justify-center rounded bg-white border-2 shadow-sm ${item.isVeg ? "border-green-500" : "border-red-500"}`}>
            <span className={`h-2 w-2 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
          </div>
        </div>
      </div>

      <div className="p-3">
        <p className="line-clamp-1 text-[13px] font-bold leading-tight text-slate-900">{item.name}</p>

        {(item.rating ?? 0) > 0 && (
          <div className="mt-1 flex items-center gap-1">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-[11px] font-semibold text-slate-600">{item.rating}</span>
            {item.reviewCount && (
              <span className="text-[10px] text-slate-400">({item.reviewCount})</span>
            )}
          </div>
        )}

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-slate-900">{formatCurrency(item.price)}</p>
            {item.comparePrice && (
              <p className="truncate text-[10px] text-slate-400 line-through">{formatCurrency(item.comparePrice)}</p>
            )}
          </div>

          <div onClick={(e) => e.stopPropagation()}>
            {cartItem ? (
              <div className="flex items-center overflow-hidden rounded-xl bg-orange-500 shadow-md">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuantity(item.id, cartItem.quantity - 1, cartItem.variant);
                  }}
                  className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-orange-600"
                >
                  <Minus className="h-3 w-3 text-white" />
                </button>
                <span className="w-5 text-center text-[11px] font-black text-white">{cartItem.quantity}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    updateQuantity(item.id, cartItem.quantity + 1, cartItem.variant);
                  }}
                  className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-orange-600"
                >
                  <Plus className="h-3 w-3 text-white" />
                </button>
              </div>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleQuickAdd}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-200"
              >
                <Plus className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MenuItemCard({ item, index, onSelect }: { item: MenuItem; index: number; onSelect: (i: MenuItem) => void }) {
  const cartItems      = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const addItem        = useCartStore((s) => s.addItem);
  const cartItem       = cartItems.find((ci) => ci.menuItemId === item.id);
  const variants       = parseJson<Variant[]>(item.variants);
  const hasCustomization = variants.length > 0;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasCustomization) { onSelect(item); return; }
    addItem({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1, image: item.image || "" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(item)}
      className="flex h-full gap-4 rounded-[20px] bg-white p-4 cursor-pointer"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 ${item.isVeg ? "border-green-500" : "border-red-500"}`}>
              <span className={`h-2 w-2 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
            </div>

            {item.isFeatured && (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">
                BESTSELLER
              </span>
            )}

            {(item.spiceLevel ?? 0) >= 3 && (
              <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-500">
                <Flame className="h-2.5 w-2.5" /> Spicy
              </span>
            )}

            {item.isAvailable === false && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                Unavailable
              </span>
            )}
          </div>

          <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-slate-900">{item.name}</h3>

          {item.description && (
            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-slate-500">
              {item.description}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-[15px] font-black text-slate-900">{formatCurrency(item.price)}</span>
          {item.comparePrice && (
            <span className="text-[12px] font-medium text-slate-400 line-through">{formatCurrency(item.comparePrice)}</span>
          )}
          {item.comparePrice && (
            <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-500">
              {Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}% off
            </span>
          )}

          {(item.rating ?? 0) > 0 && (
            <div className="ml-auto flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-600">{item.rating}</span>
              {item.reviewCount && (
                <span className="text-[10px] font-medium text-slate-400">({item.reviewCount})</span>
              )}
            </div>
          )}
        </div>

        {hasCustomization && (
          <p className="mt-1 text-[10px] font-semibold text-orange-500">⚡ Customisable</p>
        )}
      </div>

      <div className="relative shrink-0 h-28 w-28 sm:h-32 sm:w-32 md:h-28 md:w-28 lg:h-32 lg:w-32">
        <div className="h-full w-full overflow-hidden rounded-2xl bg-slate-100">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              width={128}
              height={128}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-3xl">
              🍽️
            </div>
          )}
        </div>

        <div
          className="absolute -bottom-3 left-1/2 -translate-x-1/2"
          onClick={(e) => e.stopPropagation()}
        >
          {cartItem ? (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="flex items-center overflow-hidden rounded-[10px] bg-orange-500 shadow-lg shadow-orange-200"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(item.id, cartItem.quantity - 1, cartItem.variant);
                }}
                className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-orange-600 active:bg-orange-700"
              >
                <Minus className="h-3.5 w-3.5 text-white" />
              </button>
              <span className="w-7 text-center text-[13px] font-black text-white">{cartItem.quantity}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateQuantity(item.id, cartItem.quantity + 1, cartItem.variant);
                }}
                className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-orange-600 active:bg-orange-700"
              >
                <Plus className="h-3.5 w-3.5 text-white" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={handleQuickAdd}
              className="rounded-[10px] border-2 border-orange-400 bg-white px-5 text-[12px] font-black text-orange-500 shadow-md transition-all duration-200 hover:border-orange-500 hover:bg-orange-500 hover:text-white"
              style={{ height: 32 }}
            >
              ADD
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ProductSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addItem     = useCartStore((s) => s.addItem);
  const variants    = parseJson<Variant[]>(item.variants);
  const addons      = parseJson<Addon[]>(item.addons);
  const allergens   = parseJson<string[]>(item.allergens);
  const ingredients = parseJson<string[]>(item.ingredients);

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(variants[0] || null);
  const [selectedAddons, setSelectedAddons]   = useState<Addon[]>([]);
  const [quantity, setQuantity]               = useState(1);
  const [instructions, setInstructions]       = useState("");

  const basePrice  = selectedVariant?.price ?? item.price;
  const addonTotal = selectedAddons.reduce((s, a) => s + a.price, 0);
  const totalPrice = (basePrice + addonTotal) * quantity;

  const toggleAddon = (addon: Addon) =>
    setSelectedAddons((prev) =>
      prev.find((a) => a.name === addon.name)
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon]
    );

  const handleAdd = () => {
    addItem({
      menuItemId: item.id,
      name: item.name,
      price: basePrice,
      quantity,
      variant: selectedVariant?.name,
      addons: selectedAddons,
      specialInstructions: instructions,
      image: item.image || "",
    });
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[32px] bg-white lg:max-w-2xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.16)" }}
      >
        <div className="flex justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>

        <div className="relative mx-4 mt-2 h-64 overflow-hidden rounded-[24px] bg-slate-100 lg:mx-5 lg:mt-5 lg:h-[340px]">
          {item.image ? (
            <Image
              src={item.image}
              alt={item.name}
              width={900}
              height={400}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-7xl">
              🍽️
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-lg"
          >
            <X className="h-4 w-4 text-white" />
          </motion.button>

          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md ${item.isVeg ? "border-green-400/30 bg-green-500/25 text-green-800" : "border-red-400/30 bg-red-500/25 text-red-800"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
              {item.isVeg ? "Pure Veg" : "Non-Veg"}
            </span>

            {(item.rating ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {item.rating}
                {item.reviewCount && <span className="font-normal text-slate-500">({item.reviewCount})</span>}
              </span>
            )}

            {item.prepTime && (
              <span className="flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md">
                <Clock className="h-3 w-3 text-slate-500" />
                {item.prepTime}m
              </span>
            )}
          </div>

          {item.comparePrice && (
            <div className="absolute left-3 top-3">
              <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-black text-white shadow-md">
                {Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}% OFF
              </span>
            </div>
          )}
        </div>

        <div className="space-y-5 px-5 pb-4 pt-5 lg:px-6">
          <div>
            {item.isFeatured && (
              <div className="mb-2 flex items-center gap-1.5">
                <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">
                  ⭐ BESTSELLER
                </span>
              </div>
            )}
            <h2 className="text-2xl font-black leading-tight text-slate-900">{item.name}</h2>
            {item.description && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{item.description}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xl font-black text-slate-900">{formatCurrency(basePrice)}</span>
              {item.comparePrice && (
                <span className="text-sm font-medium text-slate-400 line-through">{formatCurrency(item.comparePrice)}</span>
              )}
              {item.comparePrice && (
                <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-600">
                  Save {formatCurrency(item.comparePrice - basePrice)}
                </span>
              )}
              {item.calories && (
                <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                  <Flame className="h-3.5 w-3.5 text-orange-400" />
                  <span className="font-medium">{item.calories} kcal</span>
                </div>
              )}
            </div>
          </div>

          {variants.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-black text-slate-900">
                Choose Size / Variant <span className="text-xs font-bold text-red-500">*Required</span>
              </h3>
              <div className="space-y-2">
                {variants.map((v) => (
                  <motion.button
                    key={v.name}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedVariant(v)}
                    className={`w-full rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center justify-between ${
                      selectedVariant?.name === v.name
                        ? "border-orange-500 bg-orange-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${selectedVariant?.name === v.name ? "border-orange-500" : "border-slate-300"}`}>
                        {selectedVariant?.name === v.name && (
                          <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                        )}
                      </div>
                      <span className="text-sm font-bold text-slate-800">{v.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900">{formatCurrency(v.price)}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {addons.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-black text-slate-900">
                Add-ons <span className="text-xs font-semibold text-slate-400">(Optional)</span>
              </h3>
              <p className="mb-3 text-[11px] font-medium text-slate-400">Customise your meal</p>
              <div className="space-y-2">
                {addons.map((a) => {
                  const sel = selectedAddons.find((sa) => sa.name === a.name);
                  return (
                    <motion.button
                      key={a.name}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleAddon(a)}
                      className={`w-full rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center justify-between ${
                        sel ? "border-orange-500 bg-orange-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${sel ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                          {sel && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-800">{a.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-500">+{formatCurrency(a.price)}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-black text-slate-900">
              Special Instructions <span className="text-xs font-medium text-slate-400">(Optional)</span>
            </h3>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Less spice, extra sauce, no onions..."
              className="h-20 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {(allergens.length > 0 || ingredients.length > 0) && (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Nutritional Info</h3>
              {allergens.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Allergens</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">{allergens.join(", ")}</p>
                  </div>
                </div>
              )}
              {ingredients.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-green-100">
                    <Leaf className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ingredients</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">{ingredients.join(", ")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-0 flex items-center gap-4 bg-white pb-2 pt-2 lg:pb-4">
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-12 w-12 items-center justify-center transition-colors hover:bg-slate-200 active:bg-slate-300"
              >
                <Minus className="h-4 w-4 text-slate-700" />
              </motion.button>
              <span className="w-10 text-center text-base font-black text-slate-900">{quantity}</span>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setQuantity(quantity + 1)}
                className="flex h-12 w-12 items-center justify-center transition-colors hover:bg-slate-200 active:bg-slate-300"
              >
                <Plus className="h-4 w-4 text-slate-700" />
              </motion.button>
            </div>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAdd}
              className="flex h-12 flex-1 items-center justify-center gap-3 rounded-2xl bg-orange-500 font-black text-white shadow-lg shadow-orange-200/60 transition-colors hover:bg-orange-600"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>Add to Cart</span>
              <span className="rounded-xl bg-orange-600/50 px-2 py-0.5 text-sm font-black">
                {formatCurrency(totalPrice)}
              </span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OfferDetailModal({ offer, menuItems, onClose }: { offer: Offer; menuItems: MenuItem[]; onClose: () => void }) {
  const addItem   = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const offerRule = useOfferEngine((s) => s.offers).find((o) => o.id === offer.id);
  const isCombo   = offerRule?.offerType === "combo";

  const handleAddCombo = () => {
    if (!offerRule?.comboItems?.length || !offerRule.comboPrice) return;
    const totalOriginal = offerRule.comboItems.reduce((sum, ci) => sum + ci.originalPrice * ci.quantity, 0);
    const discount      = totalOriginal - offerRule.comboPrice;
    offerRule.comboItems.forEach((ci) => {
      const proportion   = (ci.originalPrice * ci.quantity) / totalOriginal;
      const itemDiscount = discount * proportion;
      const itemPrice    = Math.round((ci.originalPrice - itemDiscount / ci.quantity) * 100) / 100;
      addItem({
        menuItemId: ci.menuItemId,
        name: ci.name,
        price: itemPrice,
        quantity: ci.quantity,
        image: menuItems.find((m) => m.id === ci.menuItemId)?.image || "",
      });
    });
    setAdded(true);
    setTimeout(onClose, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full overflow-hidden rounded-t-[32px] bg-white lg:max-w-2xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.16)" }}
      >
        <div className="flex justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>

        <div className="relative mx-4 mt-2 h-56 overflow-hidden rounded-[24px] bg-gradient-to-br from-orange-500 via-orange-400 to-red-500 lg:mx-5 lg:mt-5 lg:h-[320px]">
          {offer.image && (
            <img src={offer.image} alt={offer.title} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-6 h-28 w-28 rounded-full bg-white/5" />

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md"
          >
            <X className="h-4 w-4 text-white" />
          </motion.button>

          {isCombo && offerRule?.comboPrice && (
            <div className="absolute bottom-4 left-4">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-orange-600 shadow-lg">
                Combo @ {formatCurrency(offerRule.comboPrice)}
              </span>
            </div>
          )}

          {!isCombo && (
            <div className="absolute bottom-4 left-4">
              <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-orange-600 shadow-lg">
                {offer.discountValue}{offer.discountType === "percentage" ? "% OFF" : " ₹ OFF"}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-4 px-5 pb-6 pt-5 lg:px-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100">
                <Percent className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-600">Special Offer</span>
            </div>
            <h2 className="text-xl font-black text-slate-900">{offer.title}</h2>
            {offer.description && (
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">{offer.description}</p>
            )}
          </div>

          {isCombo && offerRule?.comboItems && offerRule.comboItems.length > 0 && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="mb-3 text-xs font-black uppercase tracking-wide text-orange-700">🎁 Combo Includes</p>
              <div className="space-y-2.5">
                {offerRule.comboItems.map((ci, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500 text-[11px] font-black text-white shadow-sm">
                        {ci.quantity}x
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{ci.name}</span>
                    </div>
                    <span className="text-xs font-medium text-slate-400 line-through">{formatCurrency(ci.originalPrice)}</span>
                  </div>
                ))}
              </div>

              {offerRule.comboPrice && (
                <div className="mt-3 flex items-center justify-between border-t-2 border-dashed border-orange-200 pt-3">
                  <span className="text-sm font-black text-slate-900">Combo Total</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 line-through">
                      {formatCurrency(offerRule.comboItems.reduce((s, ci) => s + ci.originalPrice * ci.quantity, 0))}
                    </span>
                    <span className="text-base font-black text-green-600">{formatCurrency(offerRule.comboPrice)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isCombo && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100">
                  <Percent className="h-4 w-4 text-orange-600" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Discount</p>
                <p className="mt-1 text-sm font-black text-slate-900">
                  {offer.discountValue}{offer.discountType === "percentage" ? "% off" : " ₹ off"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100">
                  <Tag className="h-4 w-4 text-slate-600" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">How to avail</p>
                <p className="mt-1 text-sm font-black text-slate-900">Add items to cart</p>
              </div>
            </div>
          )}

          {isCombo ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAddCombo}
              disabled={added}
              className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-black shadow-lg transition-all ${
                added
                  ? "bg-green-500 text-white shadow-green-200"
                  : "bg-orange-500 text-white shadow-orange-200"
              }`}
            >
              {added ? (
                <>
                  <Check className="h-5 w-5" />
                  Added to Cart!
                </>
              ) : (
                <>
                  <ShoppingBag className="h-5 w-5" />
                  Add Combo — {offerRule?.comboPrice ? formatCurrency(offerRule.comboPrice) : ""}
                </>
              )}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-500 text-base font-black text-white shadow-lg shadow-orange-200"
            >
              <ShoppingBag className="h-5 w-5" />
              Order Now
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AllOffersModal({
  offers,
  onClose,
  onSelect,
}: {
  offers: Offer[];
  onClose: () => void;
  onSelect: (o: Offer) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-[32px] bg-[#F5F5F5] lg:max-w-3xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.16)" }}
      >
        <div className="flex justify-center pt-3 lg:hidden">
          <div className="h-1 w-12 rounded-full bg-slate-300" />
        </div>

        <div className="shrink-0 bg-[#F5F5F5] px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-900">All Offers</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">{offers.length} offers available for you</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <X className="h-4 w-4 text-slate-600" />
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 lg:px-5">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {offers.map((offer, idx) => (
              <motion.div
                key={offer.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                onClick={() => onSelect(offer)}
                className="flex cursor-pointer overflow-hidden rounded-[20px] border border-slate-100 bg-white transition-transform active:scale-[0.99]"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <div className="relative h-28 w-28 shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 to-red-500">
                  {offer.image && (
                    <img src={offer.image} alt={offer.title} className="h-full w-full object-cover" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center">
                    {!offer.image && <Percent className="h-10 w-10 text-white/50" />}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
                  <div>
                    <h3 className="line-clamp-1 text-sm font-black text-slate-900">{offer.title}</h3>
                    {offer.description && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-500">
                        {offer.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="rounded-full border border-orange-200 bg-orange-100 px-2.5 py-1 text-[10px] font-black text-orange-700">
                      {offer.discountValue}{offer.discountType === "percentage" ? "% OFF" : " ₹ OFF"}
                    </span>
                    <motion.span
                      whileHover={{ x: 3 }}
                      className="flex items-center gap-0.5 text-xs font-bold text-orange-500"
                    >
                      View <ChevronRight className="h-3.5 w-3.5" />
                    </motion.span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RewardPickerModal({ menuItems }: { menuItems: MenuItem[] }) {
  const activeOffer   = useOfferEngine((s) => s.activeOffer);
  const rewardChoices = useOfferEngine((s) => s.rewardChoices);
  const claimReward   = useOfferEngine((s) => s.claimReward);
  const dismissReward = useOfferEngine((s) => s.dismissReward);
  const [selected, setSelected] = useState<RewardChoice | null>(null);

  const choices = useMemo((): RewardChoice[] => {
    if (rewardChoices.length > 0) return rewardChoices;
    if (!activeOffer) return [];
    return activeOffer.offer.reward.rewardItemIds.map((id) => {
      const mi = menuItems.find((m) => m.id === id);
      if (!mi) return null;
      return {
        menuItemId: mi.id,
        name: mi.name,
        image: mi.image,
        originalPrice: mi.price,
        promoPrice: activeOffer.offer.reward.promoPrice,
        isVeg: mi.isVeg,
      } as RewardChoice;
    }).filter(Boolean) as RewardChoice[];
  }, [rewardChoices, activeOffer, menuItems]);

  if (!activeOffer) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={dismissReward}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full overflow-hidden rounded-t-[32px] bg-white lg:max-w-2xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.20)" }}
      >
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-400 to-red-500 px-6 py-6">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="absolute right-12 top-4 h-16 w-16 rounded-full bg-white/5" />

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={dismissReward}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
          >
            <X className="h-4 w-4 text-white" />
          </motion.button>

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm"
          >
            <Gift className="h-8 w-8 text-white" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h2 className="text-2xl font-black text-white">🎉 Offer Unlocked!</h2>
            <p className="mt-1 text-sm font-semibold text-white/85">{activeOffer.offer.title}</p>
            {activeOffer.offer.description && (
              <p className="mt-0.5 text-xs font-medium text-white/60">{activeOffer.offer.description}</p>
            )}
          </motion.div>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-5 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <h3 className="text-sm font-black text-slate-900">Choose your reward</h3>
          </div>

          <div className="space-y-2.5">
            {choices.map((choice, idx) => {
              const isSel = selected?.menuItemId === choice.menuItemId;
              return (
                <motion.button
                  key={choice.menuItemId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * idx }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelected(choice)}
                  className={`w-full rounded-2xl border-2 p-3.5 transition-all duration-200 flex items-center gap-4 ${
                    isSel
                      ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-100"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {choice.image ? (
                      <img src={choice.image} alt={choice.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                    )}
                  </div>

                  <div className="flex-1 text-left">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      {choice.isVeg !== undefined && (
                        <div className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border-2 ${choice.isVeg ? "border-green-500" : "border-red-500"}`}>
                          <span className={`h-2 w-2 rounded-full ${choice.isVeg ? "bg-green-500" : "bg-red-500"}`} />
                        </div>
                      )}
                      <h4 className="text-sm font-bold text-slate-900">{choice.name}</h4>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-slate-400 line-through">{formatCurrency(choice.originalPrice)}</span>
                      <span className="text-sm font-black text-green-600">
                        {choice.promoPrice === 0 ? "🆓 FREE" : formatCurrency(choice.promoPrice)}
                      </span>
                      <span className="rounded-full border border-green-200 bg-green-100 px-1.5 py-0.5 text-[9px] font-black text-green-700">
                        SAVE {formatCurrency(choice.originalPrice - choice.promoPrice)}
                      </span>
                    </div>
                  </div>

                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isSel ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                    {isSel && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                </motion.button>
              );
            })}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (selected) {
                claimReward(activeOffer.offer.id, selected);
                setSelected(null);
              }
            }}
            disabled={!selected}
            className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-black transition-all ${
              selected
                ? "bg-orange-500 text-white shadow-lg shadow-orange-200/60 hover:bg-orange-600"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <Gift className="h-5 w-5" />
            {selected
              ? `Claim ${selected.promoPrice === 0 ? "for FREE" : `@ ${formatCurrency(selected.promoPrice)}`}`
              : "Select a reward to continue"}
          </motion.button>

          <button
            onClick={dismissReward}
            className="w-full py-1.5 text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-600"
          >
            Skip this offer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function CartSheet({
  menuItems,
  restaurantId = "a0000000-0000-0000-0000-000000000001",
  onClose,
}: {
  menuItems: MenuItem[];
  restaurantId?: string;
  onClose: () => void;
}) {
  const cartItems      = useCartStore((s) => s.items);
  const getSubtotal    = useCartStore((s) => s.getSubtotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const addItem        = useCartStore((s) => s.addItem);
  const clearCart      = useCartStore((s) => s.clearCart);
  const setCoupon      = useCartStore((s) => s.setCoupon);
  const setNotes       = useCartStore((s) => s.setNotes);
  const setTip         = useCartStore((s) => s.setTip);
  const notes          = useCartStore((s) => s.notes);
  const tip            = useCartStore((s) => s.tip);
  const discount       = useCartStore((s) => s.discount);
  const couponCode     = useCartStore((s) => s.couponCode);
  const tableId        = useCartStore((s) => s.tableId);
  const customerName   = useCartStore((s) => s.customerName);
  const customerPhone  = useCartStore((s) => s.customerPhone);

  const promoItems       = useOfferEngine((s) => s.promoItems);
  const removePromoItem  = useOfferEngine((s) => s.removePromoItem);
  const unlockedOffers   = useOfferEngine((s) => s.unlockedOffers);
  const showRewardPicker = useOfferEngine((s) => s.showRewardPicker);
  const menuItemsCache   = useOfferEngine((s) => s.menuItemsCache);
  const buildChoices     = useOfferEngine((s) => s.buildChoicesForOffer);
  const claimReward      = useOfferEngine((s) => s.claimReward);

  const [couponInput, setCouponInput]     = useState("");
  const [couponError, setCouponError]     = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [ordering, setOrdering]           = useState(false);
  const [orderSuccess, setOrderSuccess]   = useState<{ orderNumber: string; orderId: string } | null>(null);

  const regularSubtotal    = getSubtotal();
  const promoOriginalTotal = promoItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const promoSavings       = promoOriginalTotal - promoItems.reduce((s, i) => s + i.promoPrice * i.quantity, 0);
  const couponDiscount     = discount;
  const grossSubtotal      = regularSubtotal + promoOriginalTotal;
  const totalDiscount      = couponDiscount + promoSavings;
  const taxableAmount      = Math.max(0, grossSubtotal - totalDiscount);
  const cgst               = Math.round((taxableAmount * 2.5) / 100);
  const sgst               = Math.round((taxableAmount * 2.5) / 100);
  const total              = taxableAmount + cgst + sgst + tip;

  const availableRewards = unlockedOffers.filter(
    (u) => !u.isClaimed && u.offer.reward.rewardItemIds.length > 0
  );

  const cartIds    = new Set(cartItems.map((c) => c.menuItemId));
  const promoIds   = new Set(promoItems.map((p) => p.menuItemId));
  const suggestions = menuItems.filter((mi) => !cartIds.has(mi.id) && !promoIds.has(mi.id)).slice(0, 8);

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res  = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, subtotal: regularSubtotal }),
      });
      const couponData = await res.json();
      if (couponData.valid && couponData.discount > 0) {
        const safeDiscount = Math.min(couponData.discount, regularSubtotal);
        const minOrder     = couponData.coupon?.minOrderValue ?? 0;
        setCoupon(couponInput.toUpperCase(), safeDiscount, minOrder);
      } else {
        setCouponError(couponData.error || "Invalid coupon");
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 && promoItems.length === 0) return;

    const authRes  = await fetch("/api/auth/verify-status", { method: "GET", cache: "no-store" });
    const authData = await authRes.json();

    if (!authData.authenticated) {
      const params = new URLSearchParams();
      if (tableId) params.set("table", tableId);
      const menuUrl = params.toString() ? `/menu?${params.toString()}` : "/menu";
      window.location.href = `/login?redirect=${encodeURIComponent(menuUrl)}`;
      return;
    }

    setOrdering(true);

    try {
      const allItems = [
        ...cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          originalPrice: item.price,
          promoPrice: null,
          quantity: item.quantity,
          variant: item.variant || null,
          addons: item.addons || [],
          specialInstructions: item.specialInstructions || "",
          image: item.image || "",
          isPromotional: false,
          offerId: null,
          offerTitle: null,
        })),
        ...promoItems.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          originalPrice: item.price,
          promoPrice: item.promoPrice,
          quantity: item.quantity,
          variant: null,
          addons: [],
          specialInstructions: "",
          image: item.image || "",
          isPromotional: true,
          offerId: item.offerId,
          offerTitle: item.offerTitle,
        })),
      ];

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          customerId: authData.user?.uid || null,
          customerName: authData.user?.name || customerName || "Guest",
          customerPhone: authData.user?.phone || customerPhone || "",
          items: allItems,
          subtotal: grossSubtotal,
          notes,
          couponCode,
          couponDiscount,
          promoDiscount: promoSavings,
          tip,
          restaurantId,
        }),
      });

      const orderData = await res.json();

      if (res.status === 409) {
        alert(`⚠️ ${orderData.message || "This table is already occupied."}`);
        setOrdering(false);
        return;
      }

      if (res.status === 401 && orderData.error === "login_required") {
        const params = new URLSearchParams();
        if (tableId) params.set("table", tableId);
        const menuUrl = params.toString() ? `/menu?${params.toString()}` : "/menu";
        window.location.href = `/login?redirect=${encodeURIComponent(menuUrl)}`;
        return;
      }

      if (!res.ok || !orderData.order) {
        alert(orderData.error || "Order failed. Please try again.");
        setOrdering(false);
        return;
      }

      setOrderSuccess({
        orderNumber: orderData.order.orderNumber,
        orderId: orderData.order.id,
      });

      clearCart();
    } catch (error) {
      console.error("Place order error:", error);
      alert("Network error. Please try again.");
    } finally {
      setOrdering(false);
    }
  };

  const totalCount = cartItems.length + promoItems.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50"
      style={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto bg-[#F5F5F5] lg:max-w-xl lg:rounded-l-[32px]"
        style={{ boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}
      >
        {orderSuccess ? (
          <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] bg-green-100 shadow-lg shadow-green-100"
            >
              <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-black text-slate-900">Order Placed! 🎉</h2>
              <p className="mt-2 font-medium text-slate-500">
                Order <span className="font-black text-slate-900">#{orderSuccess.orderNumber}</span> has been sent to the kitchen
              </p>
              <p className="mt-2 text-sm font-medium text-slate-400">Sit back, relax and enjoy!</p>
            </motion.div>

            <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
              <motion.a
                whileTap={{ scale: 0.97 }}
                href={`/orders/${orderSuccess.orderId}`}
                className="flex h-14 items-center justify-center rounded-2xl bg-orange-500 text-base font-black text-white shadow-lg shadow-orange-200"
              >
                Track My Order
              </motion.a>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="h-14 rounded-2xl bg-slate-100 text-base font-black text-slate-700"
              >
                Back to Menu
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-screen flex-col">

            <div
              className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-4"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100"
              >
                <ArrowLeft className="h-4.5 w-4.5 text-slate-700" />
              </motion.button>
              <div className="flex-1">
                <h2 className="text-lg font-black leading-tight text-slate-900">Your Cart</h2>
                <p className="text-xs font-medium text-slate-400">
                  {totalCount} item{totalCount !== 1 ? "s" : ""} • {tableId ? `Table ${tableId}` : "Dine In"}
                </p>
              </div>
              {totalCount > 0 && (
                <div className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black text-orange-600">
                  {formatCurrency(getSubtotal())}
                </div>
              )}
            </div>

            {totalCount === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] bg-slate-100"
                >
                  <ShoppingBag className="h-11 w-11 text-slate-300" />
                </motion.div>
                <h3 className="text-lg font-black text-slate-600">Your cart is empty</h3>
                <p className="mt-1.5 text-center text-sm font-medium text-slate-400">
                  Add delicious items from our menu
                </p>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={onClose}
                  className="mt-8 h-12 rounded-2xl bg-orange-500 px-8 text-sm font-black text-white shadow-lg shadow-orange-200"
                >
                  Browse Menu
                </motion.button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 px-4 pt-4">

                  <div className="space-y-3">
                    {cartItems.map((item, idx) => (
                      <motion.div
                        key={`${item.menuItemId}-${item.variant || ""}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex gap-3 rounded-2xl bg-white p-3.5"
                        style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                      >
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.name}
                              width={64}
                              height={64}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl">🍽️</div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{item.name}</h4>
                          {item.variant && (
                            <p className="text-[11px] font-medium text-slate-500">{item.variant}</p>
                          )}
                          {item.addons && item.addons.length > 0 && (
                            <p className="text-[10px] font-medium text-slate-400">
                              + {item.addons.map((a) => a.name).join(", ")}
                            </p>
                          )}
                          {item.specialInstructions && (
                            <p className="mt-0.5 text-[10px] font-medium italic text-amber-600">
                              📝 {item.specialInstructions}
                            </p>
                          )}

                          <div className="mt-2.5 flex items-center justify-between">
                            <span className="text-sm font-black text-slate-900">
                              {formatCurrency((item.price + (item.addons || []).reduce((s, a) => s + a.price, 0)) * item.quantity)}
                            </span>

                            <div className="flex items-center overflow-hidden rounded-xl border-2 border-slate-200 bg-white">
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                onClick={() => updateQuantity(item.menuItemId, item.quantity - 1, item.variant)}
                                className="flex h-8 w-8 items-center justify-center text-base font-black text-orange-500 transition-colors hover:bg-orange-50"
                              >
                                −
                              </motion.button>
                              <span className="w-7 text-center text-[13px] font-black text-slate-900">{item.quantity}</span>
                              <motion.button
                                whileTap={{ scale: 0.88 }}
                                onClick={() => updateQuantity(item.menuItemId, item.quantity + 1, item.variant)}
                                className="flex h-8 w-8 items-center justify-center text-base font-black text-orange-500 transition-colors hover:bg-orange-50"
                              >
                                +
                              </motion.button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {availableRewards.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="overflow-hidden rounded-2xl border-2 border-dashed border-orange-400 bg-orange-50"
                    >
                      <div className="flex items-center gap-2.5 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-3">
                        <Gift className="h-4 w-4 text-white" />
                        <span className="text-sm font-black text-white">🎁 Offers Unlocked For You!</span>
                      </div>
                      <div className="space-y-4 p-4">
                        {availableRewards.map((unlocked) => {
                          const choices = buildChoices(unlocked);
                          const filteredChoices = choices.length > 0
                            ? choices
                            : unlocked.offer.reward.rewardItemIds.map((id) => {
                                const mi = menuItems.find((m) => m.id === id);
                                if (!mi) return null;
                                return {
                                  menuItemId: mi.id,
                                  name: mi.name,
                                  image: mi.image,
                                  originalPrice: mi.price,
                                  promoPrice: unlocked.offer.reward.promoPrice,
                                  isVeg: mi.isVeg,
                                } as RewardChoice;
                              }).filter(Boolean) as RewardChoice[];

                          return (
                            <div key={unlocked.offer.id}>
                              <p className="mb-2 text-xs font-black text-orange-800">{unlocked.offer.title}</p>
                              <div className="space-y-2">
                                {filteredChoices.map((choice) => (
                                  <div
                                    key={choice.menuItemId}
                                    className="flex items-center gap-3 rounded-xl border border-orange-200 bg-white p-3 shadow-sm"
                                  >
                                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                      {choice.image ? (
                                        <img src={choice.image} alt={choice.name} className="h-full w-full object-cover" />
                                      ) : (
                                        <div className="flex h-full w-full items-center justify-center text-xl">🍽️</div>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <h5 className="line-clamp-1 text-xs font-bold text-slate-900">{choice.name}</h5>
                                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                        <span className="text-[10px] font-medium text-slate-400 line-through">
                                          {formatCurrency(choice.originalPrice)}
                                        </span>
                                        <span className="text-xs font-black text-green-600">
                                          {choice.promoPrice === 0 ? "FREE" : formatCurrency(choice.promoPrice)}
                                        </span>
                                        <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[8px] font-black text-green-700">
                                          SAVE {formatCurrency(choice.originalPrice - choice.promoPrice)}
                                        </span>
                                      </div>
                                    </div>
                                    <motion.button
                                      whileTap={{ scale: 0.9 }}
                                      onClick={() => {
                                        if (filteredChoices.length === 1) {
                                          useOfferEngine.setState({ activeOffer: unlocked });
                                          claimReward(unlocked.offer.id, choice);
                                        } else {
                                          showRewardPicker(
                                            unlocked,
                                            menuItemsCache.length > 0
                                              ? menuItemsCache
                                              : menuItems.map(menuItemToEngine)
                                          );
                                        }
                                      }}
                                      className="h-9 shrink-0 rounded-xl bg-orange-500 px-4 text-[11px] font-black text-white shadow-md shadow-orange-200 transition-colors hover:bg-orange-600"
                                    >
                                      + ADD
                                    </motion.button>
                                  </div>
                                ))}
                                {filteredChoices.length > 1 && (
                                  <p className="text-center text-[10px] font-bold text-orange-600">
                                    Tap ADD to choose your reward
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {promoItems.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                        <p className="text-xs font-black uppercase tracking-wide text-green-600">Offer Rewards Added</p>
                      </div>
                      {promoItems.map((item) => (
                        <div
                          key={`promo-${item.offerId}`}
                          className="flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-green-50 p-3"
                        >
                          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {item.image ? (
                              <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-1.5">
                              <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{item.name}</h4>
                              <span className="shrink-0 rounded-full bg-green-200 px-1.5 py-0.5 text-[8px] font-black text-green-800">
                                OFFER
                              </span>
                            </div>
                            <p className="text-[10px] font-medium text-slate-500">{item.offerTitle}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-400 line-through">{formatCurrency(item.price)}</span>
                              <span className="text-sm font-black text-green-600">
                                {item.promoPrice === 0 ? "🆓 FREE" : formatCurrency(item.promoPrice)}
                              </span>
                            </div>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.88 }}
                            onClick={() => removePromoItem(item.offerId)}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                          >
                            <X className="h-4 w-4" />
                          </motion.button>
                        </div>
                      ))}
                    </div>
                  )}

                  {suggestions.length > 0 && (
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-100">
                          <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                        </div>
                        <p className="text-sm font-black text-slate-800">Add more to your order</p>
                      </div>
                      <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
                        {suggestions.map((mi) => {
                          const inCart = cartItems.find((c) => c.menuItemId === mi.id);
                          return (
                            <div
                              key={mi.id}
                              className="w-[108px] shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
                            >
                              <div className="relative h-20 overflow-hidden bg-slate-100">
                                {mi.image ? (
                                  <Image
                                    src={mi.image}
                                    alt={mi.name}
                                    width={108}
                                    height={80}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                                )}
                                <div className="absolute left-1.5 top-1.5">
                                  <div className={`h-3.5 w-3.5 rounded border-2 ${mi.isVeg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"}`} />
                                </div>
                              </div>
                              <div className="p-2.5">
                                <p className="line-clamp-1 text-[11px] font-bold text-slate-900">{mi.name}</p>
                                <p className="mt-0.5 text-[11px] font-black text-slate-700">{formatCurrency(mi.price)}</p>
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => addItem({
                                    menuItemId: mi.id,
                                    name: mi.name,
                                    price: mi.price,
                                    quantity: 1,
                                    image: mi.image || "",
                                  })}
                                  className="mt-1.5 h-7 w-full rounded-xl border-2 border-orange-400 text-[10px] font-black text-orange-500 transition-all hover:border-orange-500 hover:bg-orange-500 hover:text-white"
                                >
                                  {inCart ? `+1 (${inCart.quantity})` : "+ ADD"}
                                </motion.button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <h3 className="mb-2.5 text-xs font-black uppercase tracking-wide text-slate-700">
                      📝 Cooking Instructions
                    </h3>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Less spice, no garlic, extra napkins..."
                      className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>

                  <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">
                      🎟️ Apply Coupon
                    </h3>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Percent className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                          placeholder="Enter coupon code"
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-[#F5F5F5] pl-10 pr-3 text-sm font-bold uppercase tracking-wider transition-all placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={handleApplyCoupon}
                        disabled={couponLoading || !couponInput.trim()}
                        className="h-11 rounded-xl bg-orange-500 px-5 text-xs font-black text-white shadow-md shadow-orange-200 transition-colors hover:bg-orange-600 disabled:opacity-40"
                      >
                        {couponLoading ? "..." : "APPLY"}
                      </motion.button>
                    </div>

                    {couponError && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center gap-1 text-xs font-bold text-red-500"
                      >
                        <X className="h-3 w-3" /> {couponError}
                      </motion.p>
                    )}

                    {couponCode && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs font-black text-green-700">{couponCode}</span>
                          <span className="text-xs font-bold text-green-600">-{formatCurrency(couponDiscount)}</span>
                        </div>
                        <button
                          onClick={() => setCoupon(null, 0)}
                          className="text-xs font-black text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </motion.div>
                    )}
                  </div>

                  <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <h3 className="mb-1 text-xs font-black uppercase tracking-wide text-slate-700">
                      💝 Add a Tip for Our Staff
                    </h3>
                    <p className="mb-3 text-[10px] font-medium text-slate-400">Show your appreciation</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 10, 20, 50].map((t) => (
                        <motion.button
                          key={t}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setTip(t)}
                          className={`h-10 rounded-xl border-2 text-xs font-black transition-all ${
                            tip === t
                              ? "border-slate-900 bg-slate-900 text-white shadow-md"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {t === 0 ? "None" : `₹${t}`}
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  <div className="h-4" />
                </div>

                <div
                  className="border-t-4 border-slate-100 bg-white px-5 pb-6 pt-5 space-y-4"
                  style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}
                >
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Bill Details</h3>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-600">Item Total</span>
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(regularSubtotal)}</span>
                    </div>

                    {promoOriginalTotal > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Offer Items (MRP)</span>
                        <span className="text-xs font-bold text-slate-500">+{formatCurrency(promoOriginalTotal)}</span>
                      </div>
                    )}

                    {promoSavings > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                          <Gift className="h-3.5 w-3.5" /> Offer Savings
                        </span>
                        <span className="text-sm font-black text-green-600">-{formatCurrency(promoSavings)}</span>
                      </div>
                    )}

                    {couponDiscount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                          <Percent className="h-3.5 w-3.5" /> Coupon ({couponCode})
                        </span>
                        <span className="text-sm font-black text-green-600">-{formatCurrency(couponDiscount)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">GST & Charges</span>
                      <span className="text-sm font-bold text-slate-500">{formatCurrency(cgst + sgst)}</span>
                    </div>

                    {tip > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Staff Tip 💝</span>
                        <span className="text-sm font-bold text-slate-500">{formatCurrency(tip)}</span>
                      </div>
                    )}

                    {(promoSavings > 0 || couponDiscount > 0) && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 px-3 py-2"
                      >
                        <span className="text-xs font-black text-green-700">💰 Total Savings</span>
                        <span className="text-sm font-black text-green-600">
                          -{formatCurrency(promoSavings + couponDiscount)}
                        </span>
                      </motion.div>
                    )}

                    <div className="border-t-2 border-dashed border-slate-200 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-slate-900">To Pay</span>
                        <span className="text-xl font-black text-slate-900">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePlaceOrder}
                    disabled={ordering || totalCount === 0}
                    className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-6 py-4 font-black text-white shadow-xl shadow-orange-200/60 transition-colors hover:bg-orange-600 disabled:opacity-50"
                  >
                    <div className="flex items-center gap-3">
                      {ordering ? (
                        <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                      <span className="text-base">{ordering ? "Placing Order..." : "Place Order"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black">{formatCurrency(total)}</span>
                      <ChevronRight className="h-5 w-5 opacity-70" />
                    </div>
                  </motion.button>

                  <p className="text-center text-[10px] font-medium text-slate-400">
                    By placing your order you agree to our Terms & Conditions
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}