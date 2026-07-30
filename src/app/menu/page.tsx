"use client";

import {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
  Search, ShoppingBag, Minus, Plus, Star, Clock, Flame,
  ChevronRight, X, Leaf, AlertTriangle, Sparkles, TrendingUp,
  Tag, ArrowLeft, Send, Percent, Gift, Check, QrCode, Lock,
} from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useOfferEngine } from "@/store/offer-engine";
import type { CartItemForEngine } from "@/store/offer-engine";
import { formatCurrency } from "@/lib/utils";
import { MenuItemSkeleton, CategorySkeleton } from "@/components/ui/skeleton";
import type {
  MenuItem, Category, Restaurant, Variant, Addon, Offer,
} from "@/lib/types";
import type { OfferRule, RewardChoice, DiscountType } from "@/lib/types";

// ═════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═════════════════════════════════════════════════════════════════════════════

const DEFAULT_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "a0000000-0000-0000-0000-000000000001";

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════

interface MenuData {
  restaurant: Restaurant | null;
  categories: Category[];
  items: MenuItem[];
  offers: OfferWithDetails[];
}

/** Offer with all fields from /api/menu — used to render 4 offer types */
interface OfferWithDetails extends Offer {
  offerType?: string;
  condition?: OfferCondition | null;
  reward?: OfferReward | null;
  comboItems?: ComboItem[];
  comboPrice?: number | null;
  priority?: number;
  maxUsagePerOrder?: number;
}

interface OfferCondition {
  requiredItemIds?: string[];
  requiredCategoryIds?: string[];
  minQuantity?: number;
  minSubtotal?: number;
  matchType?: string;
}

interface OfferReward {
  rewardItemIds?: string[];
  promoPrice?: number;
  maxQuantity?: number;
  autoAdd?: boolean;
}

interface ComboItem {
  menuItemId: string;
  name: string;
  quantity: number;
  originalPrice: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════════════

function menuItemToEngine(mi: MenuItem): CartItemForEngine {
  return {
    menuItemId: mi.id,
    name: mi.name,
    price: mi.price,
    quantity: 0,
    categoryId: mi.categoryId,
    image: mi.image,
    isVeg: mi.isVeg,
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

/** Smart badge label per offer type */
function getOfferBadgeLabel(offer: OfferWithDetails): string {
  const t = offer.offerType ?? "discount";
  if (t === "combo" && offer.comboPrice) return `Combo @ ${formatCurrency(offer.comboPrice)}`;
  if (t === "bxgy") return "Buy & Get Free";
  if (t === "free_item") return "Free Item";
  return `${offer.discountValue}${offer.discountType === "percentage" ? "% OFF" : ` ₹ OFF`}`;
}

/** Type tag with icon per offer type */
function getOfferTypeTag(offer: OfferWithDetails): { label: string; icon: typeof Percent } {
  const t = offer.offerType ?? "discount";
  if (t === "combo") return { label: "Combo Deal", icon: Gift };
  if (t === "bxgy") return { label: "Buy & Get", icon: Tag };
  if (t === "free_item") return { label: "Free Item", icon: Gift };
  return { label: "Discount", icon: Percent };
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function MenuPage() {
  const [data, setData] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<OfferWithDetails | null>(null);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [isScrolledDown, setIsScrolledDown] = useState(false);
  const [displayTable, setDisplayTable] = useState("");
  const [qrToken, setQrToken] = useState("");
  const [tableError, setTableError] = useState("");
  const [sessionCreated, setSessionCreated] = useState(false);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  const authCheckRef = useRef<{
    authenticated: boolean;
    uid?: string;
    name?: string;
    phone?: string;
  } | null>(null);

  // ── Cart selectors (v2 store — 3 entities) ─────────────────────────────────
  const currentTableId = useCartStore((s) => s.tableId);
  const tableId = useCartStore((s) => s.tableId);
  const setCustomer = useCartStore((s) => s.setCustomer);
  const setTable = useCartStore((s) => s.setTable);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const cartItems = useCartStore((s) => s.items);
  const combos = useCartStore((s) => s.combos);
  const getItemCount = useCartStore((s) => s.getItemCount);
  const itemCount = getItemCount();

  // ── Offer engine selectors ─────────────────────────────────────────────────
  const setOffers = useOfferEngine((s) => s.setOffers);
  const setMenuItemsCache = useOfferEngine((s) => s.setMenuItemsCache);
  const evaluateCart = useOfferEngine((s) => s.evaluateCart);
  const showRewardSelector = useOfferEngine((s) => s.showRewardSelector);

  // ── Auth: single fetch, cached in ref ──────────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/verify-status")
      .then((r) => r.json())
      .then((d) => {
        authCheckRef.current = {
          authenticated: !!d.authenticated,
          uid: d.user?.uid,
          name: d.user?.name,
          phone: d.user?.phone,
        };
        if (d.authenticated && d.user) {
          setCustomer(d.user.uid || "", d.user.name || "", d.user.phone || "");
        }
      })
      .catch(() => { authCheckRef.current = { authenticated: false }; });
  }, [setCustomer]);

  // ── Scroll detection for cart bar collapse ─────────────────────────────────
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

  // ── QR / Table resolve ─────────────────────────────────────────────────────
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
          const rd = await res.json();
          if (res.ok && rd.valid && rd.table) {
            if (rd.table.id !== currentTableId) setTable(rd.table.id);
            setDisplayTable(rd.table.name || `Table ${rd.table.number}`);
            setTableError("");
            return;
          }
          setTableError(rd.error || "Invalid QR");
        } catch {
          setTableError("Failed to validate QR");
        }
        return;
      }
      if (table) {
        if (table !== currentTableId) setTable(table);
        setDisplayTable(`Table ${table}`);
      } else if (currentTableId) {
        setDisplayTable(`Table ${currentTableId}`);
      } else {
        setDisplayTable("");
      }
    };
    resolve();
  }, [currentTableId, setTable]);

  // ── Menu data fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/menu");
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        setData(json as MenuData);

        if (json.items?.length) {
          setMenuItemsCache((json.items as MenuItem[]).map(menuItemToEngine));
        }
        if (json.offers?.length) {
          const rules: OfferRule[] = (json.offers as OfferWithDetails[]).map((o) => ({
            id: o.id,
            restaurantId: o.restaurantId ?? "",
            title: o.title ?? "",
            description: o.description ?? "",
            image: o.image ?? "",
            offerType: (o.offerType ?? "discount") as OfferRule["offerType"],
            discountType: (o.discountType === "flat" ? "flat" : "percentage") as DiscountType,
            discountValue: o.discountValue ?? 0,
            condition: (o.condition as OfferRule["condition"]) ?? {
              requiredItemIds: [], requiredCategoryIds: [], minQuantity: 1, matchType: "any" as const
            },
            reward: (o.reward as OfferRule["reward"]) ?? {
              rewardItemIds: [], promoPrice: 0, maxQuantity: 1, autoAdd: false
            },
            comboItems: (o.comboItems as OfferRule["comboItems"]) ?? [],
            comboPrice: o.comboPrice ?? null,
            isActive: o.isActive !== false,
            priority: o.priority ?? 0,
            maxUsagePerOrder: o.maxUsagePerOrder ?? 1,
            validFrom: null,
            validTo: null,
          }));
          setOffers(rules);
        }
      } catch (err) {
        console.error("Menu fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [setOffers, setMenuItemsCache]);

  // ── Session creation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!tableId || sessionCreated || loading) return;
    const createSession = async () => {
      if (!authCheckRef.current?.authenticated) return;
      try {
        const payload = qrToken
          ? { qrToken }
          : { tableId, restaurantId: DEFAULT_RESTAURANT_ID };
        const res = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const sd = await res.json();
        if (res.ok) { setSessionCreated(true); setTableError(""); }
        else if (res.status === 409) { setTableError(sd.message || "This table is already in use."); }
      } catch { /* best-effort */ }
    };
    createSession();
  }, [tableId, qrToken, loading, sessionCreated]);

  // ═════════════════════════════════════════════════════════════════════════
  // ✅ CRITICAL: Offer engine evaluation on cart change
  // Includes items + combos as trigger candidates (rewards excluded)
  // ═════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!data?.items?.length) return;

    const menuForEngine = data.items.map(menuItemToEngine);

    // Build trigger cart: regular items + combo items (rewards excluded)
    const triggerCart: CartItemForEngine[] = [];

    // Add regular items
    for (const ci of cartItems) {
      const mi = data.items.find((m) => m.id === ci.menuItemId);
      triggerCart.push({
        menuItemId: ci.menuItemId,
        name: ci.name,
        price: ci.price,
        quantity: ci.quantity,
        categoryId: mi?.categoryId,
        image: ci.image,
        isVeg: mi?.isVeg,
      });
    }

    // Add combo items (they DO count as trigger for BXGY/Free)
    for (const combo of combos) {
      for (const ci of combo.items) {
        const mi = data.items.find((m) => m.id === ci.menuItemId);
        triggerCart.push({
          menuItemId: ci.menuItemId,
          name: ci.name,
          price: ci.originalPrice,
          quantity: ci.quantity * combo.quantity,
          categoryId: mi?.categoryId,
          image: ci.image,
          isVeg: mi?.isVeg,
        });
      }
    }

    evaluateCart(triggerCart, menuForEngine);
  }, [cartItems, combos, data?.items, evaluateCart]);

  // ── Memoized computations ──────────────────────────────────────────────────
  const scrollToCategory = useCallback((catId: string) => {
    setActiveCategory(catId);
    const el = sectionRefs.current[catId];
    if (el) {
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 140, behavior: "smooth" });
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
    (data?.categories ?? []).forEach((c) => {
      map[c.id] = filteredItems.filter((i) => i.categoryId === c.id);
    });
    return map;
  }, [data, filteredItems]);

  const recommended = useMemo(() => filteredItems.filter((i) => i.isRecommended), [filteredItems]);
  const popular = useMemo(() => filteredItems.filter((i) => i.isPopular), [filteredItems]);
  const todaySpecial = useMemo(() => filteredItems.filter((i) => i.isTodaySpecial), [filteredItems]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
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
          <div className="mt-4 animate-pulse rounded-[20px] bg-slate-200 aspect-[16/9] max-h-[220px]" />
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

  const offersCount = data?.offers?.length ?? 0;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-32">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-40 bg-white shadow-[0_2px_20px_rgba(0,0,0,0.08)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-3">
          <div className="space-y-3 lg:grid lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-center lg:gap-4 lg:space-y-0">
            <div className="flex items-center justify-between lg:pr-2">
              <div className="flex items-center gap-3 min-w-0">
                {data?.restaurant?.logo ? (
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl shadow-sm">
                    <Image
                      src={data.restaurant.logo}
                      alt={data?.restaurant?.name ?? "Logo"}
                      fill
                      sizes="40px"
                      className="object-cover"
                      unoptimized
                      priority
                    />
                  </div>

                ) : (
                  <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0 shadow-sm">
                    <span className="text-white text-sm font-black">
                      {(data?.restaurant?.name || "R").charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-500 truncate">
                      {displayTable || "Menu"}
                    </span>
                  </div>
                  <h1 className="mt-0.5 truncate text-[16px] font-black leading-tight text-slate-900 sm:text-[18px]">
                    {data?.restaurant?.name || "Restaurant"}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {displayTable && (
                  <div className="hidden sm:flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2">
                    <span className="text-[11px] font-bold text-orange-600">{displayTable}</span>
                  </div>
                )}
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowCart(true)}
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                  type="button"
                  aria-label="Open cart"
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

            <div className="relative">
              <div className="absolute left-4 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-orange-100">
                <Search className="h-3 w-3 text-orange-500" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search for dishes, cuisines..."
                className="h-12 w-full rounded-2xl bg-[#F5F5F5] pl-11 pr-10 text-sm font-medium text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all duration-200"
                aria-label="Search menu"
              />
              <AnimatePresence>
                {search && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200"
                    type="button"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5 text-slate-500" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* ── TABLE ERROR BANNER ── */}
      <AnimatePresence>
        {tableError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8"
          >
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{tableError}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto">

        {/* ══════════════════════════════════════════════════════════════════
            PREMIUM OFFER SECTION — Swiggy / Zomato / McDonald's style
            ══════════════════════════════════════════════════════════════════ */}
        {!search && data?.offers && data.offers.length > 0 && (
          <section className="px-4 pt-5 sm:px-6 lg:px-8" aria-label="Special offers">

            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-200/50">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-black leading-none text-slate-900 sm:text-lg">Deals For You</h2>
                  <p className="mt-0.5 text-[11px] font-medium text-slate-400 truncate">
                    {offersCount} offer{offersCount > 1 ? "s" : ""} available
                  </p>
                </div>
              </div>
              {offersCount > 2 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowAllOffers(true)}
                  className="shrink-0 flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-3.5 py-1.5 text-[11px] font-bold text-orange-600 hover:bg-orange-100 transition-colors"
                  type="button"
                >
                  View All <ChevronRight className="h-3.5 w-3.5" />
                </motion.button>
              )}
            </div>

            {/* Horizontal scrollable premium offer cards */}
            <div className="relative">
              <div className="flex gap-4 overflow-x-auto pb-3 hide-scrollbar snap-x snap-mandatory scroll-smooth">
                {data.offers.map((offer, idx) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    menuItems={data.items}
                    index={idx}
                    onViewDetails={() => setSelectedOffer(offer)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── CATEGORY TABS ── */}
        {!search && data?.categories && (
          <nav
            ref={categoryScrollRef}
            className="sticky top-[108px] z-30 bg-[#F5F5F5]/95 backdrop-blur-xl lg:top-[88px]"
            aria-label="Menu categories"
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
                  type="button"
                  aria-label={`Scroll to ${cat.name}`}
                  className={`shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${activeCategory === cat.id
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-105"
                      : "bg-white text-slate-600 border border-slate-200/80 hover:border-orange-300 hover:text-orange-600 shadow-sm"
                    }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.name}</span>
                </motion.button>
              ))}
            </div>
          </nav>
        )}

        {/* ── RECOMMENDED ── */}
        {!search && recommended.length > 0 && (
          <section className="px-4 pb-2 pt-4 sm:px-6 lg:px-8" aria-label="Recommended items">
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

        {/* ── POPULAR ── */}
        {!search && popular.length > 0 && (
          <section className="px-4 pb-2 pt-2 sm:px-6 lg:px-8" aria-label="Popular items">
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

        {/* ── TODAY'S SPECIAL ── */}
        {!search && todaySpecial.length > 0 && (
          <section className="px-4 pb-2 pt-2 sm:px-6 lg:px-8" aria-label="Today's special">
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

        {/* ── MENU BY CATEGORY ── */}
        {data?.categories?.map((cat) => {
          const catItems = itemsByCategory[cat.id] ?? [];
          if (!catItems.length) return null;
          return (
            <section
              key={cat.id}
              ref={(el: HTMLDivElement | null) => { sectionRefs.current[cat.id] = el; }}
              className="pb-6"
              aria-label={`${cat.name} category`}
            >
              <div className="flex items-center gap-3 px-4 pb-4 pt-5 sm:px-6 lg:px-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-100 bg-white text-xl shadow-sm">
                  {cat.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-black text-slate-900 truncate">{cat.name}</h2>
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

        {/* ── EMPTY SEARCH ── */}
        {search && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-24 text-center sm:px-6 lg:px-8">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100">
              <Search className="h-9 w-9 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-700">No dishes found</h3>
            <p className="mt-2 text-sm font-medium text-slate-400">
              We couldn&apos;t find &quot;{search}&quot;.<br />Try a different keyword.
            </p>
            <button
              onClick={() => setSearch("")}
              type="button"
              className="mt-6 h-11 rounded-2xl bg-orange-500 px-6 text-sm font-bold text-white shadow-lg shadow-orange-200"
            >
              Clear Search
            </button>
          </div>
        )}
      </main>

      {/* ── FLOATING CART BAR ── */}
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
                  type="button"
                  aria-label="View cart"
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
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <ShoppingBag className="h-6 w-6" />
                            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black">
                              {itemCount}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-base font-black">
                              {itemCount} item{itemCount > 1 ? "s" : ""}
                            </span>
                            <span className="ml-1 text-xs font-medium text-slate-400">in cart</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-base font-black">{formatCurrency(getSubtotal())}</p>
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

      {/* ── MODALS ── */}
      <AnimatePresence>
        {selectedItem && <ProductSheet item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showCart && (
          <CartSheet
            menuItems={data?.items ?? []}
            restaurantId={data?.restaurant?.id ?? DEFAULT_RESTAURANT_ID}
            onClose={() => setShowCart(false)}
            tableDisplay={displayTable}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedOffer && (
          <OfferDetailModal
            offer={selectedOffer}
            menuItems={data?.items ?? []}
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
        {showRewardSelector && <RewardPickerModal menuItems={data?.items ?? []} />}
      </AnimatePresence>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// OFFER CARD — Premium horizontal card, one per offer
// Shows: thumbnails, price, savings, smart CTA per offer type
// ═════════════════════════════════════════════════════════════════════════════

const OfferCard = memo(function OfferCard({
  offer, menuItems, index, onViewDetails,
}: {
  offer: OfferWithDetails;
  menuItems: MenuItem[];
  index: number;
  onViewDetails: () => void;
}) {
  const addCombo = useCartStore((s) => s.addCombo);
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const offerType = (offer.offerType ?? "discount") as string;
  const isCombo = offerType === "combo";
  const isBxgy = offerType === "bxgy";
  const isFree = offerType === "free_item";
const comboItems = useMemo(() => (offer.comboItems ?? []) as ComboItem[], [offer.comboItems]);  const comboPrice = (offer.comboPrice ?? null) as number | null;
  const condition = (offer.condition ?? null) as OfferCondition | null;
  const reward = (offer.reward ?? null) as OfferReward | null;

  const totalOriginal = useMemo(
    () => comboItems.reduce((s, ci) => s + ci.originalPrice * ci.quantity, 0),
    [comboItems]
  );

  const savings = useMemo(() => {
    if (isCombo && comboPrice) return totalOriginal - comboPrice;
    return 0;
  }, [isCombo, comboPrice, totalOriginal]);

  // Resolve thumbnails
  const comboThumbnails = useMemo(
    () => comboItems.map((ci) => ({
      ...ci,
      image: menuItems.find((m) => m.id === ci.menuItemId)?.image ?? "",
      isVeg: menuItems.find((m) => m.id === ci.menuItemId)?.isVeg ?? true,
    })),
    [comboItems, menuItems]
  );

  const rewardThumbnails = useMemo(() => {
    const ids = reward?.rewardItemIds ?? [];
    return ids.map((id) => menuItems.find((m) => m.id === id)).filter(Boolean) as MenuItem[];
  }, [reward, menuItems]);

  const requiredThumbnails = useMemo(() => {
    const ids = condition?.requiredItemIds ?? [];
    return ids.map((id) => menuItems.find((m) => m.id === id)).filter(Boolean) as MenuItem[];
  }, [condition, menuItems]);

  // ═════════════════════════════════════════════════════════════════════════
  // ✅ COMBO: Add as atomic bundle via cart.addCombo()
  // ═════════════════════════════════════════════════════════════════════════
  const handleAddCombo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!comboItems.length || !comboPrice) return;

    addCombo({
      offerId: offer.id,
      title: offer.title,
      description: offer.description ?? "",
      image: offer.image ?? "",
      comboPrice: comboPrice,
      originalTotal: totalOriginal,
      items: comboItems.map((ci) => ({
        menuItemId: ci.menuItemId,
        name: ci.name,
        originalPrice: ci.originalPrice,
        quantity: ci.quantity,
        image: menuItems.find((m) => m.id === ci.menuItemId)?.image ?? "",
      })),
    });

    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [comboItems, comboPrice, addCombo, offer, totalOriginal, menuItems]);

  // ═════════════════════════════════════════════════════════════════════════
  // ✅ BXGY: Add required items → offer engine auto-unlocks reward
  // ═════════════════════════════════════════════════════════════════════════
  const handleAddBxgy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const minQty = condition?.minQuantity ?? 1;
    requiredThumbnails.forEach((mi) => {
      addItem({
        menuItemId: mi.id,
        name: mi.name,
        price: mi.price,
        quantity: minQty,
        image: mi.image ?? "",
      });
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }, [requiredThumbnails, condition, addItem]);

  const typeTag = getOfferTypeTag(offer);
  const TypeIcon = typeTag.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      onClick={onViewDetails}
      className="w-[300px] sm:w-[340px] lg:w-[380px] shrink-0 snap-start cursor-pointer overflow-hidden rounded-[20px] bg-white border border-slate-100 transition-transform active:scale-[0.98]"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
      role="button"
      aria-label={`View offer: ${offer.title}`}
    >
      {/* Card Image */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-orange-400 via-orange-500 to-red-500">
        {offer.image ? (
          <Image
            src={offer.image}
            alt={offer.title}
            fill
            sizes="(max-width: 640px) 300px, (max-width: 1024px) 340px, 380px"
            className="object-cover"
            unoptimized
            loading={index < 2 ? "eager" : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
                <TypeIcon className="h-7 w-7 text-white" />
              </div>
              <p className="text-sm font-bold text-white/80">{typeTag.label}</p>
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Type badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 shadow-lg backdrop-blur-sm">
          <TypeIcon className="h-3 w-3 text-orange-600" />
          <span className="text-[10px] font-black text-orange-700">{typeTag.label}</span>
        </div>

        {/* Savings badge */}
        {(savings > 0 || (!isCombo && offer.discountValue > 0)) && (
          <div className="absolute right-3 top-3 rounded-full bg-green-500 px-2.5 py-1 shadow-lg">
            <span className="text-[10px] font-black text-white">
              {savings > 0
                ? `SAVE ${formatCurrency(savings)}`
                : `${offer.discountValue}${offer.discountType === "percentage" ? "%" : "₹"} OFF`}
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="line-clamp-1 text-base font-black text-white drop-shadow-md sm:text-lg">
            {offer.title}
          </h3>
          {offer.description && (
            <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-white/75">
              {offer.description}
            </p>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="p-3.5 sm:p-4">

        {/* COMBO: thumbnails */}
        {isCombo && comboThumbnails.length > 0 && (
          <div className="mb-3">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Includes</p>
            <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar">
              {comboThumbnails.map((ci, cidx) => (
                <div key={cidx} className="flex shrink-0 items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-1.5">
                  <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {ci.image ? (
                      <Image src={ci.image} alt={ci.name} fill sizes="32px" className="object-cover" unoptimized loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm">🍽️</div>
                    )}
                  </div>
                  <p className="line-clamp-1 text-[11px] font-bold text-slate-700 min-w-0">
                    {ci.quantity > 1 ? `${ci.quantity}× ` : ""}{ci.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BXGY: Buy + Get thumbnails */}
        {isBxgy && (requiredThumbnails.length > 0 || rewardThumbnails.length > 0) && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            {requiredThumbnails.slice(0, 2).map((mi) => (
              <div key={mi.id} className="flex items-center gap-1.5 rounded-xl bg-blue-50 px-2.5 py-1.5">
                <div className="relative h-7 w-7 overflow-hidden rounded-lg bg-slate-100">
                  {mi.image ? (
                    <Image src={mi.image} alt={mi.name} fill sizes="28px" className="object-cover" unoptimized loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs">🍽️</div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-blue-700">Buy</span>
              </div>
            ))}
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100">
              <Plus className="h-3 w-3 text-green-600" />
            </div>
            {rewardThumbnails.slice(0, 2).map((mi) => (
              <div key={mi.id} className="flex items-center gap-1.5 rounded-xl bg-green-50 px-2.5 py-1.5">
                <div className="relative h-7 w-7 overflow-hidden rounded-lg bg-slate-100">
                  {mi.image ? (
                    <Image src={mi.image} alt={mi.name} fill sizes="28px" className="object-cover" unoptimized loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs">🍽️</div>
                  )}
                </div>
                <span className="text-[10px] font-bold text-green-700">FREE</span>
              </div>
            ))}
          </div>
        )}

        {/* FREE ITEM */}
        {isFree && rewardThumbnails.length > 0 && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
              <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-slate-100">
                {rewardThumbnails[0].image ? (
                  <Image src={rewardThumbnails[0].image} alt={rewardThumbnails[0].name} fill sizes="32px" className="object-cover" unoptimized loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm">🍽️</div>
                )}
              </div>
              <div>
                <p className="text-[10px] font-black text-green-700">FREE</p>
                <p className="text-[11px] font-bold text-slate-700">{rewardThumbnails[0].name}</p>
              </div>
            </div>
            {condition?.minSubtotal && (
              <span className="text-[10px] font-medium text-slate-400">
                on orders above {formatCurrency(condition.minSubtotal)}
              </span>
            )}
          </div>
        )}

        {/* Price + CTA row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            {isCombo && comboPrice ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-black text-slate-900">{formatCurrency(comboPrice)}</span>
                {totalOriginal > comboPrice && (
                  <span className="text-xs font-medium text-slate-400 line-through">{formatCurrency(totalOriginal)}</span>
                )}
              </div>
            ) : (
              <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-[11px] font-black text-orange-700">
                {getOfferBadgeLabel(offer)}
              </span>
            )}
          </div>

          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {isCombo && comboItems.length > 0 && comboPrice ? (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={added ? undefined : handleAddCombo}
                type="button"
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-black shadow-md transition-all ${added
                    ? "bg-green-500 text-white shadow-green-200"
                    : "bg-orange-500 text-white shadow-orange-200 hover:bg-orange-600"
                  }`}
              >
                {added ? (<><Check className="h-3.5 w-3.5" /> Added!</>) : (<><Plus className="h-3.5 w-3.5" /> Add Combo</>)}
              </motion.button>
            ) : isBxgy && requiredThumbnails.length > 0 ? (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={added ? undefined : handleAddBxgy}
                type="button"
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[12px] font-black shadow-md transition-all ${added
                    ? "bg-green-500 text-white shadow-green-200"
                    : "bg-orange-500 text-white shadow-orange-200 hover:bg-orange-600"
                  }`}
              >
                {added ? (<><Check className="h-3.5 w-3.5" /> Added!</>) : (<><Plus className="h-3.5 w-3.5" /> Add Items</>)}
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                type="button"
                className="flex items-center gap-1.5 rounded-xl border-2 border-orange-400 bg-white px-4 py-2 text-[12px] font-black text-orange-500 transition-all hover:bg-orange-500 hover:text-white"
              >
                View <ChevronRight className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
// ═════════════════════════════════════════════════════════════════════════════
// COMPACT CARD — Small horizontal-scroll card for Recommended/Popular/Special
// ═════════════════════════════════════════════════════════════════════════════

const CompactCard = memo(function CompactCard({
  item, index, onSelect,
}: {
  item: MenuItem; index: number; onSelect: (i: MenuItem) => void;
}) {
  const cartItems = useCartStore((s) => s.items);
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const cartItem = useMemo(() => cartItems.find((ci) => ci.menuItemId === item.id), [cartItems, item.id]);
  const variants = useMemo(() => parseJson<Variant[]>(item.variants), [item.variants]);
  const hasCustomization = variants.length > 0;

  const handleQuickAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasCustomization) { onSelect(item); return; }
    addItem({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1, image: item.image ?? "" });
  }, [hasCustomization, onSelect, item, addItem]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onSelect(item)}
      className="h-full min-w-0 w-40 shrink-0 cursor-pointer overflow-hidden rounded-[20px] bg-white md:w-full"
      style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
      role="button"
      aria-label={`View ${item.name}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {item.image ? (
          <Image src={item.image} alt={item.name} fill sizes="(max-width: 768px) 160px, 240px"
            className="object-cover transition-transform duration-300 hover:scale-105"
            unoptimized loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-4xl">🍽️</div>
        )}
        {item.comparePrice && item.comparePrice > item.price && (
          <div className="absolute left-2 top-2">
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white shadow-md">
              {Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}% OFF
            </span>
          </div>
        )}
        {item.isFeatured && (
          <div className="absolute right-2 top-2">
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-md">⭐ BEST</span>
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
            {item.reviewCount && <span className="text-[10px] text-slate-400">({item.reviewCount})</span>}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-slate-900">{formatCurrency(item.price)}</p>
            {item.comparePrice && item.comparePrice > item.price && (
              <p className="truncate text-[10px] text-slate-400 line-through">{formatCurrency(item.comparePrice)}</p>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {cartItem ? (
              <div className="flex items-center overflow-hidden rounded-xl bg-orange-500 shadow-md">
                <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, cartItem.quantity - 1, cartItem.variant); }}
                  type="button" aria-label="Decrease quantity"
                  className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-orange-600">
                  <Minus className="h-3 w-3 text-white" />
                </button>
                <span className="w-5 text-center text-[11px] font-black text-white">{cartItem.quantity}</span>
                <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, cartItem.quantity + 1, cartItem.variant); }}
                  type="button" aria-label="Increase quantity"
                  className="flex h-7 w-7 items-center justify-center transition-colors hover:bg-orange-600">
                  <Plus className="h-3 w-3 text-white" />
                </button>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.92 }} onClick={handleQuickAdd}
                type="button" aria-label={`Add ${item.name} to cart`}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-200">
                <Plus className="h-4 w-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// MENU ITEM CARD — Full-width card for main category listings
// ═════════════════════════════════════════════════════════════════════════════

const MenuItemCard = memo(function MenuItemCard({
  item, index, onSelect,
}: {
  item: MenuItem; index: number; onSelect: (i: MenuItem) => void;
}) {
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const addItem = useCartStore((s) => s.addItem);
  const cartItem = useMemo(() => cartItems.find((ci) => ci.menuItemId === item.id), [cartItems, item.id]);
  const variants = useMemo(() => parseJson<Variant[]>(item.variants), [item.variants]);
  const hasCustomization = variants.length > 0;

  const handleQuickAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasCustomization) { onSelect(item); return; }
    addItem({ menuItemId: item.id, name: item.name, price: item.price, quantity: 1, image: item.image ?? "" });
  }, [hasCustomization, onSelect, item, addItem]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(item)}
      className="flex h-full gap-4 rounded-[20px] bg-white p-4 cursor-pointer"
      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
      role="button"
      aria-label={`View ${item.name}`}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border-2 ${item.isVeg ? "border-green-500" : "border-red-500"}`}>
              <span className={`h-2 w-2 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
            </div>
            {item.isFeatured && (
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-700">BESTSELLER</span>
            )}
            {(item.spiceLevel ?? 0) >= 3 && (
              <span className="flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-[9px] font-bold text-red-500">
                <Flame className="h-2.5 w-2.5" /> Spicy
              </span>
            )}
            {item.isAvailable === false && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">Unavailable</span>
            )}
          </div>
          <h3 className="line-clamp-1 text-[15px] font-bold leading-snug text-slate-900">{item.name}</h3>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-[12px] font-medium leading-relaxed text-slate-500">{item.description}</p>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-black text-slate-900">{formatCurrency(item.price)}</span>
          {item.comparePrice && item.comparePrice > item.price && (
            <span className="text-[12px] font-medium text-slate-400 line-through">{formatCurrency(item.comparePrice)}</span>
          )}
          {item.comparePrice && item.comparePrice > item.price && (
            <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-500">
              {Math.round(((item.comparePrice - item.price) / item.comparePrice) * 100)}% off
            </span>
          )}
          {(item.rating ?? 0) > 0 && (
            <div className="ml-auto flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-600">{item.rating}</span>
              {item.reviewCount && <span className="text-[10px] font-medium text-slate-400">({item.reviewCount})</span>}
            </div>
          )}
        </div>
        {hasCustomization && <p className="mt-1 text-[10px] font-semibold text-orange-500">⚡ Customisable</p>}
      </div>

      <div className="relative shrink-0 h-28 w-28 sm:h-32 sm:w-32 md:h-28 md:w-28 lg:h-32 lg:w-32">
        <div className="h-full w-full overflow-hidden rounded-2xl bg-slate-100">
          {item.image ? (
            <Image src={item.image} alt={item.name} fill sizes="(max-width: 640px) 112px, 128px"
              className="object-cover" unoptimized loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-3xl">🍽️</div>
          )}
        </div>
        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2" onClick={(e) => e.stopPropagation()}>
          {cartItem ? (
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="flex items-center overflow-hidden rounded-[10px] bg-orange-500 shadow-lg shadow-orange-200">
              <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, cartItem.quantity - 1, cartItem.variant); }}
                type="button" aria-label="Decrease quantity"
                className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-orange-600 active:bg-orange-700">
                <Minus className="h-3.5 w-3.5 text-white" />
              </button>
              <span className="w-7 text-center text-[13px] font-black text-white">{cartItem.quantity}</span>
              <button onClick={(e) => { e.stopPropagation(); updateQuantity(item.id, cartItem.quantity + 1, cartItem.variant); }}
                type="button" aria-label="Increase quantity"
                className="flex h-8 w-8 items-center justify-center transition-colors hover:bg-orange-600 active:bg-orange-700">
                <Plus className="h-3.5 w-3.5 text-white" />
              </button>
            </motion.div>
          ) : (
            <motion.button whileTap={{ scale: 0.92 }} onClick={handleQuickAdd}
              type="button" aria-label={`Add ${item.name}`}
              className="rounded-[10px] border-2 border-orange-400 bg-white px-4 py-1.5 text-[12px] font-black text-orange-500 shadow-md transition-all duration-200 hover:border-orange-500 hover:bg-orange-500 hover:text-white whitespace-nowrap">
              ADD
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// PRODUCT SHEET — Modal for product details with variants, addons, instructions
// ═════════════════════════════════════════════════════════════════════════════

const ProductSheet = memo(function ProductSheet({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const addItem = useCartStore((s) => s.addItem);
  const variants = useMemo(() => parseJson<Variant[]>(item.variants), [item.variants]);
  const addons = useMemo(() => parseJson<Addon[]>(item.addons), [item.addons]);
  const allergens = useMemo(() => parseJson<string[]>(item.allergens), [item.allergens]);
  const ingredients = useMemo(() => parseJson<string[]>(item.ingredients), [item.ingredients]);

  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(variants[0] ?? null);
  const [selectedAddons, setSelectedAddons] = useState<Addon[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");

  const basePrice = selectedVariant?.price ?? item.price;
  const addonTotal = useMemo(() => selectedAddons.reduce((s, a) => s + a.price, 0), [selectedAddons]);
  const totalPrice = (basePrice + addonTotal) * quantity;

  const toggleAddon = useCallback((addon: Addon) => {
    setSelectedAddons((prev) =>
      prev.find((a) => a.name === addon.name)
        ? prev.filter((a) => a.name !== addon.name)
        : [...prev, addon]
    );
  }, []);

  const handleAdd = useCallback(() => {
    addItem({
      menuItemId: item.id, name: item.name, price: basePrice, quantity,
      variant: selectedVariant?.name, addons: selectedAddons,
      specialInstructions: instructions, image: item.image ?? "",
    });
    onClose();
  }, [addItem, item, basePrice, quantity, selectedVariant, selectedAddons, instructions, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
      role="dialog"
      aria-label={`${item.name} details`}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94vh] w-full overflow-y-auto rounded-t-[32px] bg-white lg:max-w-2xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.16)" }}
      >
        <div className="flex justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>

        <div className="relative mx-4 mt-2 overflow-hidden rounded-[24px] bg-slate-100 lg:mx-5 lg:mt-5">
          <div className="relative aspect-[16/10] w-full">
            {item.image ? (
              <Image src={item.image} alt={item.name} fill sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover" unoptimized priority />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 text-7xl">🍽️</div>
            )}
          </div>
          <button onClick={onClose} type="button" aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md shadow-lg">
            <X className="h-4 w-4 text-white" />
          </button>
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
            <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md ${item.isVeg ? "border-green-400/30 bg-green-500/25 text-green-800" : "border-red-400/30 bg-red-500/25 text-red-800"}`}>
              <span className={`h-2.5 w-2.5 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
              {item.isVeg ? "Pure Veg" : "Non-Veg"}
            </span>
            {(item.rating ?? 0) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {item.rating}
              </span>
            )}
            {item.prepTime && (
              <span className="flex items-center gap-1 rounded-full bg-white/85 px-3 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md">
                <Clock className="h-3 w-3 text-slate-500" />{item.prepTime}m
              </span>
            )}
          </div>
          {item.comparePrice && item.comparePrice > item.price && (
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
              <div className="mb-2"><span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[10px] font-black text-amber-700">⭐ BESTSELLER</span></div>
            )}
            <h2 className="text-2xl font-black leading-tight text-slate-900">{item.name}</h2>
            {item.description && <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{item.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xl font-black text-slate-900">{formatCurrency(basePrice)}</span>
              {item.comparePrice && item.comparePrice > item.price && (
                <>
                  <span className="text-sm font-medium text-slate-400 line-through">{formatCurrency(item.comparePrice)}</span>
                  <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-600">
                    Save {formatCurrency(item.comparePrice - basePrice)}
                  </span>
                </>
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
                  <button key={v.name} onClick={() => setSelectedVariant(v)} type="button"
                    className={`w-full rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center justify-between ${selectedVariant?.name === v.name ? "border-orange-500 bg-orange-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${selectedVariant?.name === v.name ? "border-orange-500" : "border-slate-300"}`}>
                        {selectedVariant?.name === v.name && <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />}
                      </div>
                      <span className="text-sm font-bold text-slate-800 truncate">{v.name}</span>
                    </div>
                    <span className="text-sm font-black text-slate-900 shrink-0">{formatCurrency(v.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {addons.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-black text-slate-900">Add-ons <span className="text-xs font-semibold text-slate-400">(Optional)</span></h3>
              <p className="mb-3 text-[11px] font-medium text-slate-400">Customise your meal</p>
              <div className="space-y-2">
                {addons.map((a) => {
                  const sel = selectedAddons.find((sa) => sa.name === a.name);
                  return (
                    <button key={a.name} onClick={() => toggleAddon(a)} type="button"
                      className={`w-full rounded-2xl border-2 px-4 py-3.5 transition-all duration-200 flex items-center justify-between ${sel ? "border-orange-500 bg-orange-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${sel ? "border-orange-500 bg-orange-500" : "border-slate-300"}`}>
                          {sel && <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <span className="text-sm font-bold text-slate-800 truncate">{a.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-500 shrink-0">+{formatCurrency(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-black text-slate-900">Special Instructions <span className="text-xs font-medium text-slate-400">(Optional)</span></h3>
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Less spice, extra sauce, no onions..."
              className="h-20 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-800 transition-all placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          {(allergens.length > 0 || ingredients.length > 0) && (
            <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <h3 className="text-xs font-black uppercase tracking-wide text-slate-700">Nutritional Info</h3>
              {allergens.length > 0 && (
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="min-w-0">
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
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Ingredients</p>
                    <p className="mt-0.5 text-xs font-medium text-slate-700">{ingredients.join(", ")}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-0 flex items-center gap-4 bg-white pb-2 pt-2 lg:pb-4">
            <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shrink-0">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} type="button" aria-label="Decrease"
                className="flex h-12 w-12 items-center justify-center transition-colors hover:bg-slate-200 active:bg-slate-300">
                <Minus className="h-4 w-4 text-slate-700" />
              </button>
              <span className="w-10 text-center text-base font-black text-slate-900">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} type="button" aria-label="Increase"
                className="flex h-12 w-12 items-center justify-center transition-colors hover:bg-slate-200 active:bg-slate-300">
                <Plus className="h-4 w-4 text-slate-700" />
              </button>
            </div>
            <button onClick={handleAdd} type="button"
              className="flex h-12 flex-1 min-w-0 items-center justify-center gap-2 rounded-2xl bg-orange-500 font-black text-white shadow-lg shadow-orange-200/60 transition-colors hover:bg-orange-600">
              <ShoppingBag className="h-5 w-5 shrink-0" />
              <span className="truncate">Add to Cart</span>
              <span className="rounded-xl bg-orange-600/50 px-2 py-0.5 text-sm font-black shrink-0">{formatCurrency(totalPrice)}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// OFFER DETAIL MODAL — Premium detail view for all 4 offer types
// ═════════════════════════════════════════════════════════════════════════════

const OfferDetailModal = memo(function OfferDetailModal({
  offer, menuItems, onClose,
}: {
  offer: OfferWithDetails;
  menuItems: MenuItem[];
  onClose: () => void;
}) {
  const addCombo = useCartStore((s) => s.addCombo);
  const addItem = useCartStore((s) => s.addItem);
  const [added, setAdded] = useState(false);
  const [addingAnimation, setAddingAnimation] = useState(false);

  const offerType = (offer.offerType ?? "discount") as string;
  const isCombo = offerType === "combo";
  const isBxgy = offerType === "bxgy";
  const isFree = offerType === "free_item";
  const isDiscount = !isCombo && !isBxgy && !isFree;

  const comboItems = useMemo(() => (offer.comboItems ?? []) as ComboItem[], [offer.comboItems]);
  const comboPrice = (offer.comboPrice ?? null) as number | null;
  const condition = (offer.condition ?? null) as OfferCondition | null;
  const reward = (offer.reward ?? null) as OfferReward | null;

  const totalOriginal = useMemo(
    () => comboItems.reduce((sum, ci) => sum + ci.originalPrice * ci.quantity, 0),
    [comboItems]
  );

  const savings = useMemo(() => {
    if (isCombo && comboPrice) return totalOriginal - comboPrice;
    return 0;
  }, [isCombo, comboPrice, totalOriginal]);

  const comboItemsFull = useMemo(
    () => comboItems.map((ci) => ({
      ...ci,
      image: menuItems.find((m) => m.id === ci.menuItemId)?.image ?? "",
      isVeg: menuItems.find((m) => m.id === ci.menuItemId)?.isVeg ?? true,
    })),
    [comboItems, menuItems]
  );

  const requiredItems = useMemo(() => {
    const reqIds = condition?.requiredItemIds ?? [];
    if (!reqIds.length) return [];
    return reqIds.map((id) => menuItems.find((m) => m.id === id)).filter(Boolean) as MenuItem[];
  }, [condition, menuItems]);

  const rewardItems = useMemo(() => {
    const ids = reward?.rewardItemIds ?? [];
    if (!ids.length) return [];
    return ids.map((id) => menuItems.find((m) => m.id === id)).filter(Boolean) as MenuItem[];
  }, [reward, menuItems]);

  const typeTag = useMemo(() => getOfferTypeTag(offer), [offer]);
  const TypeIcon = typeTag.icon;

  // ─── ✅ COMBO: Atomic add via cart.addCombo() ─────────────────────────────
  const handleAddCombo = useCallback(() => {
    if (!comboItems.length || !comboPrice) return;
    setAddingAnimation(true);

    addCombo({
      offerId: offer.id,
      title: offer.title,
      description: offer.description ?? "",
      image: offer.image ?? "",
      comboPrice: comboPrice,
      originalTotal: totalOriginal,
      items: comboItems.map((ci) => ({
        menuItemId: ci.menuItemId,
        name: ci.name,
        originalPrice: ci.originalPrice,
        quantity: ci.quantity,
        image: menuItems.find((m) => m.id === ci.menuItemId)?.image ?? "",
      })),
    });

    setAdded(true);
    setTimeout(() => {
      setAddingAnimation(false);
      onClose();
    }, 1200);
  }, [comboItems, comboPrice, addCombo, menuItems, onClose, offer, totalOriginal]);

  // ─── ✅ BXGY: Add required items → engine auto-unlocks reward ─────────────
  const handleAddBxgy = useCallback(() => {
    if (requiredItems.length === 0) return;
    setAddingAnimation(true);
    const minQty = condition?.minQuantity ?? 1;
    requiredItems.forEach((mi) => {
      addItem({
        menuItemId: mi.id,
        name: mi.name,
        price: mi.price,
        quantity: minQty,
        image: mi.image ?? "",
      });
    });
    setAdded(true);
    setTimeout(() => {
      setAddingAnimation(false);
      onClose();
    }, 1200);
  }, [requiredItems, condition, addItem, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
      role="dialog"
      aria-label={`Offer: ${offer.title}`}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[92vh] overflow-y-auto rounded-t-[32px] bg-white lg:max-w-2xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.16)" }}
      >
        <div className="flex justify-center pb-1 pt-3 lg:hidden">
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>

        {/* Hero Banner */}
        <div className="relative mx-4 mt-2 overflow-hidden rounded-[24px] lg:mx-5 lg:mt-5">
          <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-orange-500 via-orange-400 to-red-500">
            {offer.image ? (
              <Image src={offer.image} alt={offer.title} fill sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover" unoptimized priority />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm">
                    <TypeIcon className="h-10 w-10 text-white" />
                  </div>
                  <p className="text-lg font-black text-white/90">{typeTag.label}</p>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            <button onClick={onClose} type="button" aria-label="Close"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-md">
              <X className="h-4 w-4 text-white" />
            </button>

            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-black text-orange-700 shadow-lg backdrop-blur-sm shrink-0">
                <TypeIcon className="h-3.5 w-3.5" />
                {typeTag.label}
              </span>
              {isCombo && comboPrice ? (
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-orange-600 shadow-lg shrink-0">
                  {formatCurrency(comboPrice)}
                </span>
              ) : savings > 0 ? (
                <span className="rounded-full bg-green-500 px-3 py-1.5 text-[11px] font-black text-white shadow-lg shrink-0">
                  SAVE {formatCurrency(savings)}
                </span>
              ) : offer.discountValue > 0 ? (
                <span className="rounded-full bg-white px-4 py-2 text-sm font-black text-orange-600 shadow-lg shrink-0">
                  {offer.discountValue}{offer.discountType === "percentage" ? "% OFF" : " ₹ OFF"}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 pb-6 pt-5 lg:px-6">
          <div>
            <h2 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl">{offer.title}</h2>
            {offer.description && (
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{offer.description}</p>
            )}
          </div>

          {/* ═══ COMBO DETAILS ═══ */}
          {isCombo && comboItemsFull.length > 0 && (
            <div className="space-y-3">
              {savings > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500 shadow-md shadow-green-200">
                    <Tag className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-wide text-green-700">You Save</p>
                    <p className="text-xl font-black text-green-600">{formatCurrency(savings)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] font-medium text-slate-400">MRP Total</p>
                    <p className="text-sm font-bold text-slate-400 line-through">{formatCurrency(totalOriginal)}</p>
                  </div>
                </motion.div>
              )}

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-700">
                  <Gift className="h-4 w-4 text-orange-500" />
                  What&apos;s Included ({comboItemsFull.length} items)
                </p>
                <div className="space-y-3">
                  {comboItemsFull.map((ci, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + idx * 0.08 }}
                      className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {ci.image ? (
                          <Image src={ci.image} alt={ci.name} fill sizes="56px" className="object-cover" unoptimized loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xl">🍽️</div>
                        )}
                        {ci.quantity > 1 && (
                          <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[9px] font-black text-white shadow-sm">
                            {ci.quantity}×
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-2 ${ci.isVeg ? "border-green-500" : "border-red-500"}`}>
                            <span className={`h-2 w-2 rounded-full ${ci.isVeg ? "bg-green-500" : "bg-red-500"}`} />
                          </div>
                          <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{ci.name}</h4>
                        </div>
                        <p className="mt-0.5 text-[11px] font-medium text-slate-400">
                          {ci.quantity > 1 ? `${ci.quantity} × ` : ""}{formatCurrency(ci.originalPrice)} each
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-slate-400 line-through">
                          {formatCurrency(ci.originalPrice * ci.quantity)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {comboPrice && (
                  <div className="mt-4 space-y-2 border-t-2 border-dashed border-slate-200 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">Total MRP</span>
                      <span className="text-sm font-bold text-slate-400 line-through">{formatCurrency(totalOriginal)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-green-600">Combo Discount</span>
                        <span className="text-sm font-black text-green-600">-{formatCurrency(savings)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-base font-black text-slate-900">Combo Price</span>
                      <span className="text-xl font-black text-slate-900">{formatCurrency(comboPrice)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ BXGY DETAILS ═══ */}
          {isBxgy && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-blue-700">
                  <ShoppingBag className="h-4 w-4" />
                  Buy These Items
                </p>
                {requiredItems.length > 0 ? (
                  <div className="space-y-2.5">
                    {requiredItems.map((mi, idx) => (
                      <motion.div
                        key={mi.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + idx * 0.08 }}
                        className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {mi.image ? (
                            <Image src={mi.image} alt={mi.name} fill sizes="48px" className="object-cover" unoptimized loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg">🍽️</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-2 ${mi.isVeg ? "border-green-500" : "border-red-500"}`}>
                              <span className={`h-2 w-2 rounded-full ${mi.isVeg ? "bg-green-500" : "bg-red-500"}`} />
                            </div>
                            <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{mi.name}</h4>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-black text-slate-900">{formatCurrency(mi.price)}</span>
                      </motion.div>
                    ))}
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-blue-600">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-200 text-[9px] font-black text-blue-700">i</span>
                      Minimum {condition?.minQuantity ?? 1} item(s) required
                    </p>
                  </div>
                ) : condition?.minSubtotal ? (
                  <div className="rounded-xl bg-white p-3 shadow-sm">
                    <p className="text-sm font-bold text-slate-700">
                      Order above <span className="text-blue-600">{formatCurrency(condition.minSubtotal)}</span>
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Add qualifying items to your cart</p>
                )}
              </div>

              <div className="flex justify-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 shadow-sm">
                  <ChevronRight className="h-5 w-5 text-green-600 rotate-90" />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-green-700">
                  <Gift className="h-4 w-4" />
                  You Get (Auto-Added on Trigger)
                </p>
                {rewardItems.length > 0 ? (
                  <div className="space-y-2.5">
                    {rewardItems.map((mi, idx) => (
                      <motion.div
                        key={mi.id}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + idx * 0.08 }}
                        className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm border border-green-200"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {mi.image ? (
                            <Image src={mi.image} alt={mi.name} fill sizes="48px" className="object-cover" unoptimized loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-lg">🍽️</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-2 ${mi.isVeg ? "border-green-500" : "border-red-500"}`}>
                              <span className={`h-2 w-2 rounded-full ${mi.isVeg ? "bg-green-500" : "bg-red-500"}`} />
                            </div>
                            <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{mi.name}</h4>
                          </div>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-slate-400 line-through">{formatCurrency(mi.price)}</span>
                            <span className="text-sm font-black text-green-600">
                              {reward?.promoPrice === 0 ? "🆓 FREE" : formatCurrency(reward?.promoPrice ?? 0)}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-green-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm">
                          {reward?.promoPrice === 0 ? "FREE" : `SAVE ${formatCurrency(mi.price - (reward?.promoPrice ?? 0))}`}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white p-4 text-center shadow-sm">
                    <span className="text-3xl">🎁</span>
                    <p className="mt-1 text-sm font-bold text-green-700">
                      {reward?.promoPrice === 0 ? "FREE Item!" : `Item @ ${formatCurrency(reward?.promoPrice ?? 0)}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ FREE ITEM DETAILS ═══ */}
          {isFree && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                <p className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-700">
                  <ShoppingBag className="h-4 w-4" />
                  How to Unlock
                </p>
                {condition?.minSubtotal ? (
                  <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                      <Tag className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">Order above {formatCurrency(condition.minSubtotal)}</p>
                      <p className="text-[11px] font-medium text-slate-400">Free item unlocks automatically</p>
                    </div>
                  </div>
                ) : requiredItems.length > 0 ? (
                  <div className="space-y-2">
                    {requiredItems.map((mi) => (
                      <div key={mi.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          {mi.image ? (
                            <Image src={mi.image} alt={mi.name} fill sizes="40px" className="object-cover" unoptimized loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-base">🍽️</div>
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-700 min-w-0 truncate flex-1">{mi.name}</span>
                        <span className="shrink-0 text-sm font-black text-slate-900">{formatCurrency(mi.price)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Add items to unlock this reward</p>
                )}
              </div>

              {rewardItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4"
                >
                  <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-green-700">
                    <Gift className="h-4 w-4" />
                    You&apos;ll Get FREE
                  </p>
                  {rewardItems.map((mi) => (
                    <div key={mi.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm border border-green-200">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {mi.image ? (
                          <Image src={mi.image} alt={mi.name} fill sizes="56px" className="object-cover" unoptimized loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{mi.name}</h4>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-slate-400 line-through">{formatCurrency(mi.price)}</span>
                          <span className="text-base font-black text-green-600">🆓 FREE</span>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-500 px-2.5 py-1 text-[10px] font-black text-white">
                        SAVE {formatCurrency(mi.price)}
                      </span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          )}

          {/* ═══ SIMPLE DISCOUNT DETAILS ═══ */}
          {isDiscount && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100">
                    <Percent className="h-5 w-5 text-orange-600" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Discount</p>
                  <p className="mt-1 text-lg font-black text-slate-900">
                    {offer.discountValue}{offer.discountType === "percentage" ? "%" : "₹"} OFF
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <Tag className="h-5 w-5 text-slate-600" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">How to Avail</p>
                  <p className="mt-1 text-sm font-black text-slate-900">Auto-applied</p>
                  <p className="text-[11px] font-medium text-slate-400">at checkout</p>
                </div>
              </div>

              {requiredItems.length > 0 && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">Applicable on</p>
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                    {requiredItems.map((mi) => (
                      <div key={mi.id} className="flex shrink-0 items-center gap-2.5 rounded-xl bg-white p-2.5 shadow-sm">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                          {mi.image ? (
                            <Image src={mi.image} alt={mi.name} fill sizes="40px" className="object-cover" unoptimized loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-base">🍽️</div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-[11px] font-bold text-slate-700">{mi.name}</p>
                          <p className="text-[10px] font-medium text-slate-400">{formatCurrency(mi.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Availability */}
          <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[11px] font-bold text-green-700">Available Now</span>
            {offer.maxUsagePerOrder && offer.maxUsagePerOrder > 0 && (
              <span className="ml-auto text-[10px] font-medium text-green-600 shrink-0">
                Max {offer.maxUsagePerOrder}× per order
              </span>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="sticky bottom-0 bg-white pt-2 pb-2 lg:pb-4 space-y-2">
            {isCombo ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAddCombo}
                disabled={added || !comboPrice}
                type="button"
                className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black shadow-xl transition-all ${added
                    ? "bg-green-500 text-white shadow-green-200"
                    : addingAnimation
                      ? "bg-orange-400 text-white shadow-orange-200"
                      : "bg-orange-500 text-white shadow-orange-200 hover:bg-orange-600"
                  }`}
              >
                {added ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                    <Check className="h-5 w-5" /> Combo Added! 🎉
                  </motion.span>
                ) : addingAnimation ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Adding...
                  </span>
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5 shrink-0" />
                    <span className="truncate">Add Combo</span>
                    <span className="rounded-xl bg-orange-600/50 px-3 py-1 text-sm shrink-0">
                      {comboPrice ? formatCurrency(comboPrice) : ""}
                    </span>
                  </>
                )}
              </motion.button>
            ) : isBxgy && requiredItems.length > 0 ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAddBxgy}
                disabled={added}
                type="button"
                className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-black shadow-xl transition-all ${added
                    ? "bg-green-500 text-white shadow-green-200"
                    : "bg-orange-500 text-white shadow-orange-200 hover:bg-orange-600"
                  }`}
              >
                {added ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                    <Check className="h-5 w-5" /> Added! Reward Unlocked 🎉
                  </motion.span>
                ) : (
                  <>
                    <ShoppingBag className="h-5 w-5 shrink-0" />
                    <span className="truncate">Add Items to Cart</span>
                  </>
                )}
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                type="button"
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-base font-black text-white shadow-xl shadow-orange-200 hover:bg-orange-600"
              >
                <ShoppingBag className="h-5 w-5 shrink-0" />
                <span className="truncate">Browse Menu & Add Items</span>
              </motion.button>
            )}

            {isDiscount && (
              <p className="text-center text-[11px] font-medium text-slate-400">
                Discount applies automatically on qualifying items
              </p>
            )}
            {isFree && (
              <p className="text-center text-[11px] font-medium text-slate-400">
                Free item unlocks automatically when condition is met
              </p>
            )}
            {isBxgy && requiredItems.length === 0 && (
              <p className="text-center text-[11px] font-medium text-slate-400">
                Add qualifying items — reward unlocks automatically
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// ALL OFFERS MODAL — Grid view of all available offers
// ═════════════════════════════════════════════════════════════════════════════

const AllOffersModal = memo(function AllOffersModal({
  offers, onClose, onSelect,
}: {
  offers: OfferWithDetails[];
  onClose: () => void;
  onSelect: (o: OfferWithDetails) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(8px)", backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
      role="dialog"
      aria-label="All offers"
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
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
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-md shadow-orange-200/50">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-black text-slate-900 truncate">All Offers</h2>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {offers.length} deal{offers.length > 1 ? "s" : ""} available
                </p>
              </div>
            </div>
            <button onClick={onClose} type="button" aria-label="Close"
              className="shrink-0 flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-6 lg:px-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {offers.map((o, idx) => {
              const typeTag = getOfferTypeTag(o);
              const TypeIcon = typeTag.icon;
              const oType = (o.offerType ?? "discount") as string;
              const oComboItems = (o.comboItems ?? []) as ComboItem[];
              const oComboPrice = (o.comboPrice ?? null) as number | null;
              const oTotalOriginal = oComboItems.reduce((s, ci) => s + ci.originalPrice * ci.quantity, 0);
              const oSavings = oType === "combo" && oComboPrice ? oTotalOriginal - oComboPrice : 0;

              return (
                <motion.div
                  key={o.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  onClick={() => onSelect(o)}
                  className="cursor-pointer overflow-hidden rounded-[20px] bg-white border border-slate-100 transition-transform active:scale-[0.98]"
                  style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
                  role="button"
                  aria-label={`View offer: ${o.title}`}
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-orange-400 to-red-500">
                    {o.image ? (
                      <Image src={o.image} alt={o.title} fill sizes="(max-width: 640px) 100vw, 50vw"
                        className="object-cover" unoptimized loading="lazy" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <TypeIcon className="h-10 w-10 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 shadow-md backdrop-blur-sm">
                      <TypeIcon className="h-2.5 w-2.5 text-orange-600" />
                      <span className="text-[9px] font-black text-orange-700">{typeTag.label}</span>
                    </div>

                    {(oSavings > 0 || (oType !== "combo" && o.discountValue > 0)) && (
                      <div className="absolute right-2.5 top-2.5 rounded-full bg-green-500 px-2 py-0.5 shadow-md">
                        <span className="text-[9px] font-black text-white">
                          {oSavings > 0
                            ? `SAVE ${formatCurrency(oSavings)}`
                            : `${o.discountValue}${o.discountType === "percentage" ? "%" : "₹"} OFF`}
                        </span>
                      </div>
                    )}

                    <div className="absolute bottom-2.5 left-2.5 right-2.5">
                      <h3 className="line-clamp-1 text-sm font-black text-white drop-shadow-md">{o.title}</h3>
                    </div>
                  </div>

                  <div className="p-3.5">
                    {o.description && (
                      <p className="mb-2 line-clamp-2 text-[11px] font-medium leading-relaxed text-slate-500">{o.description}</p>
                    )}

                    {oType === "combo" && oComboItems.length > 0 && (
                      <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-slate-400 shrink-0">{oComboItems.length} items</span>
                        <span className="text-slate-300 shrink-0">•</span>
                        <span className="text-[10px] font-bold text-slate-400 line-clamp-1 min-w-0">
                          {oComboItems.map((ci) => ci.name).join(", ")}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      {oType === "combo" && oComboPrice ? (
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-base font-black text-slate-900">{formatCurrency(oComboPrice)}</span>
                          {oTotalOriginal > oComboPrice && (
                            <span className="text-[11px] font-medium text-slate-400 line-through">{formatCurrency(oTotalOriginal)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-[10px] font-black text-orange-700 truncate">
                          {getOfferBadgeLabel(o)}
                        </span>
                      )}
                      <span className="shrink-0 flex items-center gap-0.5 text-xs font-bold text-orange-500">
                        Details <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
// ═════════════════════════════════════════════════════════════════════════════
// REWARD PICKER MODAL — Shown when offer has multiple reward choices
// ═════════════════════════════════════════════════════════════════════════════

const RewardPickerModal = memo(function RewardPickerModal({ menuItems }: { menuItems: MenuItem[] }) {
  const activeOffer = useOfferEngine((s) => s.activeOffer);
  const rewardChoices = useOfferEngine((s) => s.rewardChoices);
  const claimReward = useOfferEngine((s) => s.claimReward);
  const dismissRewardPicker = useOfferEngine((s) => s.dismissRewardPicker);
  const dismissRewardInCart = useCartStore((s) => s.dismissReward);

  const [selected, setSelected] = useState<RewardChoice | null>(null);
  const [claiming, setClaiming] = useState(false);

  const choices = useMemo((): RewardChoice[] => {
    if (rewardChoices.length > 0) return rewardChoices;
    if (!activeOffer) return [];
    return activeOffer.offer.reward.rewardItemIds
      .map((id) => {
        const mi = menuItems.find((m) => m.id === id);
        if (!mi) return null;
        return {
          menuItemId: mi.id, name: mi.name, image: mi.image,
          originalPrice: mi.price, promoPrice: activeOffer.offer.reward.promoPrice, isVeg: mi.isVeg,
        } as RewardChoice;
      })
      .filter(Boolean) as RewardChoice[];
  }, [rewardChoices, activeOffer, menuItems]);

  const handleClaim = useCallback(() => {
    if (!selected || !activeOffer) return;
    setClaiming(true);
    claimReward(activeOffer.offer.id, selected);
    setTimeout(() => {
      setClaiming(false);
      setSelected(null);
    }, 600);
  }, [selected, activeOffer, claimReward]);

  const handleSkip = useCallback(() => {
    // Mark this offer as dismissed for the session so engine doesn't re-suggest
    if (activeOffer) {
      dismissRewardInCart(activeOffer.offer.id);
    }
    dismissRewardPicker();
  }, [activeOffer, dismissRewardInCart, dismissRewardPicker]);

  if (!activeOffer) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center px-0 lg:items-center lg:px-6 lg:py-6"
      style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(0,0,0,0.65)" }}
      onClick={dismissRewardPicker}
      role="dialog"
      aria-label="Choose your reward"
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-h-[90vh] overflow-y-auto rounded-t-[32px] bg-white lg:max-w-2xl lg:rounded-[32px]"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.20)" }}
      >
        <div className="relative bg-gradient-to-br from-orange-500 via-orange-400 to-red-500 px-6 py-6">
          <button onClick={dismissRewardPicker} type="button" aria-label="Dismiss"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <X className="h-4 w-4 text-white" />
          </button>
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <Gift className="h-8 w-8 text-white" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-2xl font-black text-white">🎉 Offer Unlocked!</h2>
            <p className="mt-1 text-sm font-semibold text-white/85 truncate">{activeOffer.offer.title}</p>
            {activeOffer.offer.description && (
              <p className="mt-0.5 text-xs font-medium text-white/60 line-clamp-2">{activeOffer.offer.description}</p>
            )}
          </motion.div>
        </div>

        <div className="space-y-4 px-5 pb-6 pt-5 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100">
              <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            </div>
            <h3 className="text-sm font-black text-slate-900">
              {choices.length > 1 ? "Choose your reward" : "Your reward"}
            </h3>
          </div>

          {choices.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                <Gift className="h-8 w-8 text-slate-300" />
              </div>
              <p className="text-sm font-bold text-slate-500">No rewards available</p>
              <p className="mt-1 text-xs text-slate-400">Reward items currently unavailable</p>
              <button onClick={dismissRewardPicker} type="button"
                className="mt-4 h-10 rounded-xl bg-slate-100 px-6 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>
          )}

          {choices.length > 0 && (
            <>
              <div className="space-y-2.5">
                {choices.map((choice, idx) => {
                  const isSel = selected?.menuItemId === choice.menuItemId;
                  return (
                    <motion.button
                      key={choice.menuItemId}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + idx * 0.06 }}
                      onClick={() => setSelected(choice)}
                      type="button"
                      className={`w-full rounded-2xl border-2 p-3.5 transition-all duration-200 flex items-center gap-4 ${isSel ? "border-orange-500 bg-orange-50 shadow-md shadow-orange-100" : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {choice.image ? (
                          <Image src={choice.image} alt={choice.name} fill sizes="64px"
                            className="object-cover" unoptimized loading="lazy" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="mb-0.5 flex items-center gap-1.5">
                          {choice.isVeg !== undefined && (
                            <div className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border-2 ${choice.isVeg ? "border-green-500" : "border-red-500"}`}>
                              <span className={`h-2 w-2 rounded-full ${choice.isVeg ? "bg-green-500" : "bg-red-500"}`} />
                            </div>
                          )}
                          <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{choice.name}</h4>
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
                      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${isSel ? "border-orange-500 bg-orange-500" : "border-slate-300"
                        }`}>
                        {isSel && <Check className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <button
                onClick={handleClaim}
                disabled={!selected || claiming}
                type="button"
                className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl text-base font-black transition-all ${claiming
                    ? "bg-green-500 text-white shadow-lg shadow-green-200"
                    : selected
                      ? "bg-orange-500 text-white shadow-lg shadow-orange-200/60 hover:bg-orange-600"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
              >
                {claiming ? (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                    <Check className="h-5 w-5" /> Claimed! 🎉
                  </motion.span>
                ) : (
                  <>
                    <Gift className="h-5 w-5 shrink-0" />
                    <span className="truncate">
                      {selected
                        ? `Claim ${selected.promoPrice === 0 ? "for FREE" : `@ ${formatCurrency(selected.promoPrice)}`}`
                        : "Select a reward to continue"}
                    </span>
                  </>
                )}
              </button>
            </>
          )}

          <button onClick={handleSkip} type="button"
            className="w-full py-1.5 text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-600">
            Skip this offer
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});

// ═════════════════════════════════════════════════════════════════════════════
// CART SHEET — Premium 3-section cart (Items / Combos / Rewards)
// ═════════════════════════════════════════════════════════════════════════════

const CartSheet = memo(function CartSheet({
  menuItems,
  restaurantId = DEFAULT_RESTAURANT_ID,
  onClose,
  tableDisplay = "",
}: {
  menuItems: MenuItem[];
  restaurantId?: string;
  onClose: () => void;
  tableDisplay?: string;
}) {
  // ── Cart selectors (v2) ────────────────────────────────────────────────────
  const cartItems = useCartStore((s) => s.items);
  const combos = useCartStore((s) => s.combos);
  const rewards = useCartStore((s) => s.rewards);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const addItem = useCartStore((s) => s.addItem);
  const removeCombo = useCartStore((s) => s.removeCombo);
  const updateComboQty = useCartStore((s) => s.updateComboQuantity);
  const dismissReward = useCartStore((s) => s.dismissReward);
  const clearCart = useCartStore((s) => s.clearCart);
  const setCoupon = useCartStore((s) => s.setCoupon);
  const setNotes = useCartStore((s) => s.setNotes);
  const setTip = useCartStore((s) => s.setTip);
  const notes = useCartStore((s) => s.notes);
  const tip = useCartStore((s) => s.tip);
  const discount = useCartStore((s) => s.discount);
  const couponCode = useCartStore((s) => s.couponCode);
  const tableId = useCartStore((s) => s.tableId);
  const customerName = useCartStore((s) => s.customerName);
  const customerPhone = useCartStore((s) => s.customerPhone);

  const getItemsSubtotal = useCartStore((s) => s.getItemsSubtotal);
  const getCombosSubtotal = useCartStore((s) => s.getCombosSubtotal);
  const getCombosMrp = useCartStore((s) => s.getCombosMrp);
  const getCombosSavings = useCartStore((s) => s.getCombosSavings);
  const getRewardsSubtotal = useCartStore((s) => s.getRewardsSubtotal);
  const getRewardsMrp = useCartStore((s) => s.getRewardsMrp);
  const getRewardsSavings = useCartStore((s) => s.getRewardsSavings);

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<{ orderNumber: string; orderId: string } | null>(null);

  // ── Memoized calculations ──────────────────────────────────────────────────
// ✅ Cleaner alternative — Zustand handles memoization internally
const itemsSubtotal   = getItemsSubtotal();
const combosSubtotal  = getCombosSubtotal();
const combosMrp       = getCombosMrp();
const combosSavings   = getCombosSavings();
const rewardsSubtotal = getRewardsSubtotal();
const rewardsMrp      = getRewardsMrp();
const rewardsSavings  = getRewardsSavings();

  const couponDiscount = discount;

  // Bill calculation — items priced normally, combos at combo price, rewards mostly free
  const payableSubtotal = itemsSubtotal + combosSubtotal + rewardsSubtotal;
  const taxableAmount = Math.max(0, payableSubtotal - couponDiscount);
  const cgst = Math.round((taxableAmount * 2.5) / 100);
  const sgst = Math.round((taxableAmount * 2.5) / 100);
  const total = taxableAmount + cgst + sgst + tip;
  const totalSavings = combosSavings + rewardsSavings + couponDiscount;

  const suggestions = useMemo(() => {
    const cartIds = new Set(cartItems.map((c) => c.menuItemId));
    const comboIds = new Set(combos.flatMap((c) => c.items.map((i) => i.menuItemId)));
    const rewardIds = new Set(rewards.map((r) => r.menuItemId));
    return menuItems.filter((mi) =>
      !cartIds.has(mi.id) && !comboIds.has(mi.id) && !rewardIds.has(mi.id)
    ).slice(0, 8);
  }, [cartItems, combos, rewards, menuItems]);

  const tableLabel = tableDisplay || (tableId ? `Table ${tableId}` : "No table selected");
  const totalCount = cartItems.length + combos.length + rewards.length;

  // ═════════════════════════════════════════════════════════════════════════
  // COUPON HANDLER
  // ═════════════════════════════════════════════════════════════════════════
  const handleApplyCoupon = useCallback(async () => {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, subtotal: itemsSubtotal + combosSubtotal }),
      });
      const couponData = await res.json();
      if (couponData.valid && couponData.discount > 0) {
        const safeDiscount = Math.min(couponData.discount, itemsSubtotal + combosSubtotal);
        const minOrder = couponData.coupon?.minOrderValue ?? 0;
        setCoupon(couponInput.toUpperCase(), safeDiscount, minOrder);
      } else {
        setCouponError(couponData.error || "Invalid coupon");
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }, [couponInput, itemsSubtotal, combosSubtotal, setCoupon]);

  // ═════════════════════════════════════════════════════════════════════════
  // PLACE ORDER HANDLER — Includes items + combos + rewards
  // ═════════════════════════════════════════════════════════════════════════
  const handlePlaceOrder = useCallback(async () => {
    if (totalCount === 0) return;
    if (!tableId) return;

    setOrdering(true);
    try {
      // Flatten combos into order items with combo metadata
      const comboOrderItems = combos.flatMap((combo) =>
        combo.items.map((ci) => ({
          menuItemId: ci.menuItemId,
          name: ci.name,
          price: ci.originalPrice,     // MRP for display
          originalPrice: ci.originalPrice,
          promoPrice: null,
          quantity: ci.quantity * combo.quantity,
          variant: null,
          addons: [],
          specialInstructions: `[Combo: ${combo.title}]`,
          image: ci.image,
          isPromotional: false,
          offerId: combo.offerId,
          offerTitle: combo.title,
          isComboItem: true,
          comboId: combo.comboId,
          comboPrice: combo.comboPrice,     // per unit
          comboQuantity: combo.quantity,       // combo units
        }))
      );

      const allItems = [
        ...cartItems.map((item) => ({
          menuItemId: item.menuItemId,
          name: item.name,
          price: item.price,
          originalPrice: item.price,
          promoPrice: null,
          quantity: item.quantity,
          variant: item.variant ?? null,
          addons: item.addons ?? [],
          specialInstructions: item.specialInstructions ?? "",
          image: item.image ?? "",
          isPromotional: false,
          offerId: null,
          offerTitle: null,
          isComboItem: false,
        })),
        ...comboOrderItems,
        ...rewards.map((reward) => ({
          menuItemId: reward.menuItemId,
          name: reward.name,
          price: reward.originalPrice,
          originalPrice: reward.originalPrice,
          promoPrice: reward.promoPrice,
          quantity: reward.quantity,
          variant: null,
          addons: [],
          specialInstructions: `[Reward: ${reward.offerTitle}]`,
          image: reward.image,
          isPromotional: true,
          offerId: reward.offerId,
          offerTitle: reward.offerTitle,
          isComboItem: false,
          isReward: true,
        })),
      ];

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          customerId: null,
          customerName: customerName || "Guest",
          customerPhone: customerPhone || "",
          items: allItems,
          subtotal: itemsSubtotal + combosMrp + rewardsMrp,   // gross MRP
          notes,
          couponCode,
          couponDiscount,
          promoDiscount: rewardsSavings,     // reward savings
          comboDiscount: combosSavings,      // combo savings
          totalSavings,                       // all savings combined
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

      setOrderSuccess({ orderNumber: orderData.order.orderNumber, orderId: orderData.order.id });
      clearCart();
    } catch (error) {
      console.error("Place order error:", error);
      alert("Network error. Please try again.");
    } finally {
      setOrdering(false);
    }
  }, [
    totalCount, tableId, cartItems, combos, rewards,
    customerName, customerPhone, itemsSubtotal, combosMrp, rewardsMrp,
    notes, couponCode, couponDiscount, rewardsSavings, combosSavings, totalSavings,
    tip, restaurantId, clearCart
  ]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50"
      style={{ backdropFilter: "blur(4px)", backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
      role="dialog"
      aria-label="Shopping cart"
    >
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md overflow-y-auto bg-[#F5F5F5] lg:max-w-xl lg:rounded-l-[32px]"
        style={{ boxShadow: "-8px 0 40px rgba(0,0,0,0.12)" }}
      >
        {orderSuccess ? (
          <div className="flex min-h-screen flex-col items-center justify-center bg-white p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-[32px] bg-green-100 shadow-lg shadow-green-100">
              <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <h2 className="text-2xl font-black text-slate-900">Order Placed! 🎉</h2>
            <p className="mt-2 font-medium text-slate-500">
              Order <span className="font-black text-slate-900">#{orderSuccess.orderNumber}</span> sent to kitchen
            </p>
            <p className="mt-2 text-sm font-medium text-slate-400">Sit back, relax and enjoy!</p>
            <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
              <a href={`/orders/${orderSuccess.orderId}`}
                className="flex h-14 items-center justify-center rounded-2xl bg-orange-500 text-base font-black text-white shadow-lg shadow-orange-200">
                Track My Order
              </a>
              <button onClick={onClose} type="button"
                className="h-14 rounded-2xl bg-slate-100 text-base font-black text-slate-700">
                Back to Menu
              </button>
            </div>
          </div>
        ) : (
          <div className="flex min-h-screen flex-col">

            {/* Cart Header */}
            <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-100 bg-white px-5 py-4"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <button onClick={onClose} type="button" aria-label="Close cart"
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100">
                <ArrowLeft className="h-4 w-4 text-slate-700" />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black leading-tight text-slate-900">Your Cart</h2>
                <p className="text-xs font-medium text-slate-400 truncate">
                  {totalCount} item{totalCount !== 1 ? "s" : ""} • {tableLabel}
                </p>
              </div>
              {payableSubtotal > 0 && (
                <div className="shrink-0 rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black text-orange-600">
                  {formatCurrency(payableSubtotal)}
                </div>
              )}
            </div>

            {/* QR Warning */}
            {!tableId && (
              <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3" role="alert">
                <QrCode className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-800">Scan Table QR First</p>
                  <p className="text-xs font-medium text-amber-600 mt-0.5">Scan QR to place order</p>
                </div>
              </div>
            )}

            {totalCount === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
                <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[28px] bg-slate-100">
                  <ShoppingBag className="h-11 w-11 text-slate-300" />
                </div>
                <h3 className="text-lg font-black text-slate-600">Your cart is empty</h3>
                <p className="mt-1.5 text-center text-sm font-medium text-slate-400">Add delicious items from our menu</p>
                <button onClick={onClose} type="button"
                  className="mt-8 h-12 rounded-2xl bg-orange-500 px-8 text-sm font-black text-white shadow-lg shadow-orange-200">
                  Browse Menu
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-4 px-4 pt-4">

                  {/* ═════════ SECTION 1: REGULAR ITEMS ═════════ */}
                  {cartItems.length > 0 && (
                    <div className="space-y-3">
                      {cartItems.length > 0 && combos.length + rewards.length > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-slate-300" />
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Your Items</p>
                          <div className="flex-1 h-px bg-slate-200" />
                        </div>
                      )}
                      {cartItems.map((item, idx) => (
                        <motion.div key={`${item.menuItemId}-${item.variant ?? ""}`}
                          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="flex gap-3 rounded-2xl bg-white p-3.5"
                          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            {item.image ? (
                              <Image src={item.image} alt={item.name} fill sizes="64px"
                                className="object-cover" unoptimized loading="lazy" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xl">🍽️</div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{item.name}</h4>
                            {item.variant && <p className="text-[11px] font-medium text-slate-500 truncate">{item.variant}</p>}
                            {item.addons && item.addons.length > 0 && (
                              <p className="text-[10px] font-medium text-slate-400 truncate">
                                + {item.addons.map((a) => a.name).join(", ")}
                              </p>
                            )}
                            {item.specialInstructions && (
                              <p className="mt-0.5 text-[10px] font-medium italic text-amber-600 truncate">
                                📝 {item.specialInstructions}
                              </p>
                            )}
                            <div className="mt-2.5 flex items-center justify-between gap-2">
                              <span className="text-sm font-black text-slate-900 shrink-0">
                                {formatCurrency((item.price + (item.addons ?? []).reduce((s, a) => s + a.price, 0)) * item.quantity)}
                              </span>
                              <div className="flex items-center overflow-hidden rounded-xl border-2 border-slate-200 bg-white shrink-0">
                                <button onClick={() => updateQuantity(item.menuItemId, item.quantity - 1, item.variant)}
                                  type="button" aria-label="Decrease"
                                  className="flex h-8 w-8 items-center justify-center text-base font-black text-orange-500 hover:bg-orange-50 transition-colors">−</button>
                                <span className="w-7 text-center text-[13px] font-black text-slate-900">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.menuItemId, item.quantity + 1, item.variant)}
                                  type="button" aria-label="Increase"
                                  className="flex h-8 w-8 items-center justify-center text-base font-black text-orange-500 hover:bg-orange-50 transition-colors">+</button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* ═════════ SECTION 2: COMBO BUNDLES (Atomic) ═════════ */}
                  {combos.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500">
                          <Gift className="h-3 w-3 text-white" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-orange-600">
                          Combo Deals ({combos.length})
                        </p>
                        <div className="flex-1 h-px bg-orange-200" />
                      </div>
                      {combos.map((combo, idx) => (
                        <motion.div
                          key={combo.comboId}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="overflow-hidden rounded-2xl border-2 border-orange-200 bg-white"
                          style={{ boxShadow: "0 4px 20px rgba(255,107,0,0.12)" }}
                        >
                          <div className="flex items-center gap-2.5 bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5">
                            <Gift className="h-4 w-4 text-white shrink-0" />
                            <span className="text-xs font-black text-white uppercase tracking-wide flex-1 truncate">
                              🎁 Combo Deal
                            </span>
                            <span className="shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-black text-white">
                              SAVE {formatCurrency((combo.originalTotal - combo.comboPrice) * combo.quantity)}
                            </span>
                          </div>

                          <div className="p-3.5">
                            <div className="flex gap-3">
                              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                                {combo.image ? (
                                  <Image src={combo.image} alt={combo.title} fill sizes="64px"
                                    className="object-cover" unoptimized loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 to-red-100">
                                    <Gift className="h-6 w-6 text-orange-500" />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="line-clamp-1 text-sm font-black text-slate-900">{combo.title}</h4>
                                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                                  {combo.items.length} items included
                                </p>
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-medium text-slate-400 line-through">
                                    {formatCurrency(combo.originalTotal * combo.quantity)}
                                  </span>
                                  <span className="text-base font-black text-slate-900">
                                    {formatCurrency(combo.comboPrice * combo.quantity)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Included items list */}
                            <div className="mt-3 space-y-1.5 rounded-xl bg-orange-50/60 p-2.5">
                              {combo.items.map((ci) => (
                                <div key={ci.menuItemId} className="flex items-center gap-2">
                                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-lg bg-white">
                                    {ci.image ? (
                                      <Image src={ci.image} alt={ci.name} fill sizes="28px"
                                        className="object-cover" unoptimized loading="lazy" />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center text-xs">🍽️</div>
                                    )}
                                  </div>
                                  <span className="flex-1 min-w-0 truncate text-[11px] font-semibold text-slate-700">
                                    {ci.quantity * combo.quantity}× {ci.name}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Combo Quantity + Remove */}
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div className="flex items-center overflow-hidden rounded-xl border-2 border-orange-300 bg-white shrink-0">
                                <button onClick={() => updateComboQty(combo.comboId, combo.quantity - 1)}
                                  type="button" aria-label="Decrease combo quantity"
                                  className="flex h-8 w-8 items-center justify-center text-base font-black text-orange-500 hover:bg-orange-50 transition-colors">−</button>
                                <span className="w-8 text-center text-[13px] font-black text-slate-900">{combo.quantity}</span>
                                <button onClick={() => updateComboQty(combo.comboId, combo.quantity + 1)}
                                  type="button" aria-label="Increase combo quantity"
                                  className="flex h-8 w-8 items-center justify-center text-base font-black text-orange-500 hover:bg-orange-50 transition-colors">+</button>
                              </div>
                              <button onClick={() => removeCombo(combo.comboId)}
                                type="button" aria-label="Remove combo"
                                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-black text-red-500 hover:bg-red-100 transition-colors">
                                <X className="h-3.5 w-3.5" />
                                Remove
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* ═════════ SECTION 3: LOCKED REWARDS (Engine-Managed) ═════════ */}
                  {rewards.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
                          <Lock className="h-2.5 w-2.5 text-white" />
                        </div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-green-600">
                          Unlocked Rewards ({rewards.length})
                        </p>
                        <div className="flex-1 h-px bg-green-200" />
                      </div>
                      {rewards.map((reward, idx) => (
                        <motion.div
                          key={reward.rewardId}
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-3.5"
                          style={{ boxShadow: "0 2px 12px rgba(34,197,94,0.10)" }}
                        >
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-white">
                            {reward.image ? (
                              <Image src={reward.image} alt={reward.name} fill sizes="56px"
                                className="object-cover" unoptimized loading="lazy" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-2xl">🎁</div>
                            )}
                            <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 shadow-sm">
                              <Lock className="h-2.5 w-2.5 text-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-1.5 flex-wrap">
                              <h4 className="line-clamp-1 text-sm font-bold text-slate-900">{reward.name}</h4>
                              <span className="shrink-0 rounded-full bg-green-200 px-1.5 py-0.5 text-[8px] font-black text-green-800">
                                {reward.promoPrice === 0 ? "FREE" : "OFFER"}
                              </span>
                            </div>
                            <p className="text-[10px] font-medium text-slate-500 truncate">🎁 {reward.offerTitle}</p>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-slate-400 line-through">
                                {formatCurrency(reward.originalPrice)}
                              </span>
                              <span className="text-sm font-black text-green-600">
                                {reward.promoPrice === 0 ? "🆓 FREE" : formatCurrency(reward.promoPrice)}
                              </span>
                              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[9px] font-black text-green-700">
                                SAVE {formatCurrency(reward.originalPrice - reward.promoPrice)}
                              </span>
                            </div>
                          </div>
                          <button onClick={() => dismissReward(reward.offerId)}
                            type="button" aria-label="Reject reward"
                            title="Reject this reward"
                            className="shrink-0 flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </motion.div>
                      ))}
                      <p className="px-1 text-[10px] font-medium text-slate-400 flex items-center gap-1">
                        <Lock className="h-2.5 w-2.5" />
                        Rewards are locked and managed automatically based on your cart
                      </p>
                    </div>
                  )}

                  {/* Suggestions */}
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
                            <div key={mi.id} className="w-[108px] shrink-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                                {mi.image ? (
                                  <Image src={mi.image} alt={mi.name} fill sizes="108px"
                                    className="object-cover" unoptimized loading="lazy" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
                                )}
                                <div className="absolute left-1.5 top-1.5">
                                  <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border-2 ${mi.isVeg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"}`} />
                                </div>
                              </div>
                              <div className="p-2.5">
                                <p className="line-clamp-1 text-[11px] font-bold text-slate-900">{mi.name}</p>
                                <p className="mt-0.5 text-[11px] font-black text-slate-700">{formatCurrency(mi.price)}</p>
                                <button type="button"
                                  onClick={() => addItem({ menuItemId: mi.id, name: mi.name, price: mi.price, quantity: 1, image: mi.image ?? "" })}
                                  className="mt-1.5 h-7 w-full rounded-xl border-2 border-orange-400 text-[10px] font-black text-orange-500 hover:border-orange-500 hover:bg-orange-500 hover:text-white transition-all">
                                  {inCart ? `+1 (${inCart.quantity})` : "+ ADD"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cooking Instructions */}
                  <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <h3 className="mb-2.5 text-xs font-black uppercase tracking-wide text-slate-700">📝 Cooking Instructions</h3>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Less spice, no garlic, extra napkins..."
                      className="h-16 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
                  </div>

                  {/* Coupon */}
                  <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-slate-700">🎟️ Apply Coupon</h3>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Percent className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input value={couponInput}
                          onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                          placeholder="Enter coupon code"
                          className="h-11 w-full rounded-xl border-2 border-slate-200 bg-[#F5F5F5] pl-10 pr-3 text-sm font-bold uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all" />
                      </div>
                      <button onClick={handleApplyCoupon} type="button"
                        disabled={couponLoading || !couponInput.trim()}
                        className="shrink-0 h-11 rounded-xl bg-orange-500 px-5 text-xs font-black text-white shadow-md shadow-orange-200 hover:bg-orange-600 disabled:opacity-40 transition-all">
                        {couponLoading ? "..." : "APPLY"}
                      </button>
                    </div>
                    {couponError && (
                      <p className="mt-2 flex items-center gap-1 text-xs font-bold text-red-500">
                        <X className="h-3 w-3" /> {couponError}
                      </p>
                    )}
                    {couponCode && (
                      <div className="mt-2 flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                          <span className="text-xs font-black text-green-700 truncate">{couponCode}</span>
                          <span className="text-xs font-bold text-green-600 shrink-0">-{formatCurrency(couponDiscount)}</span>
                        </div>
                        <button onClick={() => setCoupon(null, 0)} type="button" className="shrink-0 text-xs font-black text-red-500 hover:text-red-600 ml-2">Remove</button>
                      </div>
                    )}
                  </div>

                  {/* Tip */}
                  <div className="rounded-2xl bg-white p-4" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                    <h3 className="mb-1 text-xs font-black uppercase tracking-wide text-slate-700">💝 Add a Tip for Staff</h3>
                    <p className="mb-3 text-[10px] font-medium text-slate-400">Show your appreciation</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[0, 10, 20, 50].map((t) => (
                        <button key={t} onClick={() => setTip(t)} type="button"
                          className={`h-10 rounded-xl border-2 text-xs font-black transition-all ${tip === t ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                            }`}>
                          {t === 0 ? "None" : `₹${t}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-4" />
                </div>

                {/* Bill Details + Place Order */}
                <div className="border-t-4 border-slate-100 bg-white px-5 pb-6 pt-5 space-y-4"
                  style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.08)" }}>
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-900">Bill Details</h3>
                  <div className="space-y-2.5">

                    {/* Items */}
                    {itemsSubtotal > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">Item Total</span>
                        <span className="text-sm font-bold text-slate-900">{formatCurrency(itemsSubtotal)}</span>
                      </div>
                    )}

                    {/* Combos */}
                    {combos.length > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">Combo Items (MRP)</span>
                          <span className="text-xs font-bold text-slate-500">+{formatCurrency(combosMrp)}</span>
                        </div>
                        {combosSavings > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                              <Gift className="h-3.5 w-3.5" /> Combo Savings
                            </span>
                            <span className="text-sm font-black text-green-600">-{formatCurrency(combosSavings)}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Rewards */}
                    {rewards.length > 0 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-500">Reward Items (MRP)</span>
                          <span className="text-xs font-bold text-slate-500">+{formatCurrency(rewardsMrp)}</span>
                        </div>
                        {rewardsSavings > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                              <Gift className="h-3.5 w-3.5" /> Offer Rewards
                            </span>
                            <span className="text-sm font-black text-green-600">-{formatCurrency(rewardsSavings)}</span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Coupon */}
                    {couponDiscount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm font-bold text-green-600">
                          <Percent className="h-3.5 w-3.5" /> Coupon ({couponCode})
                        </span>
                        <span className="text-sm font-black text-green-600">-{formatCurrency(couponDiscount)}</span>
                      </div>
                    )}

                    {/* GST */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-500">GST & Charges</span>
                      <span className="text-sm font-bold text-slate-500">{formatCurrency(cgst + sgst)}</span>
                    </div>

                    {/* Tip */}
                    {tip > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500">Staff Tip 💝</span>
                        <span className="text-sm font-bold text-slate-500">{formatCurrency(tip)}</span>
                      </div>
                    )}

                    {/* Total Savings Highlight */}
                    {totalSavings > 0 && (
                      <div className="flex items-center justify-between rounded-xl border-2 border-green-200 bg-green-50 px-3 py-2">
                        <span className="text-xs font-black text-green-700">💰 Total Savings</span>
                        <span className="text-sm font-black text-green-600">-{formatCurrency(totalSavings)}</span>
                      </div>
                    )}

                    {/* Grand Total */}
                    <div className="border-t-2 border-dashed border-slate-200 pt-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-base font-black text-slate-900">To Pay</span>
                        <span className="text-xl font-black text-slate-900">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Place Order Button */}
                  <button
                    onClick={handlePlaceOrder}
                    disabled={ordering || totalCount === 0 || !tableId}
                    type="button"
                    className="flex w-full items-center justify-between rounded-2xl bg-orange-500 px-6 py-4 font-black text-white shadow-xl shadow-orange-200/60 hover:bg-orange-600 disabled:opacity-50 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {ordering ? (
                        <svg className="h-5 w-5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : !tableId ? (
                        <QrCode className="h-5 w-5 shrink-0" />
                      ) : (
                        <Send className="h-5 w-5 shrink-0" />
                      )}
                      <span className="text-base truncate">
                        {ordering ? "Placing Order..." : !tableId ? "Scan QR to Order" : "Place Order"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-lg font-black">{formatCurrency(total)}</span>
                      <ChevronRight className="h-5 w-5 opacity-70" />
                    </div>
                  </button>

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
});