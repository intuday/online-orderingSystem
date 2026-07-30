// src/app/api/menu/route.ts
//
// Public menu data endpoint — returns restaurant info, categories, items, and offers.
//
// Caching strategy:
//   - In-memory module-level cache (CACHE_TTL = 60s)
//   - Effective for warm serverless instances and long-running servers
//   - Does NOT persist across cold serverless invocations (by design)
//   - For production at scale: replace with Vercel KV or Redis
//
// Firestore reads per cold request: 4 (restaurant, categories, products, offers)
// Firestore reads per warm request: 0 (served from cache)

import { NextResponse } from "next/server";
import {
  db, collection, getDocs,
  doc, getDoc, query, where,
} from "@/lib/firebase-admin";
import type { MenuItem, Category, Restaurant, Offer } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";
const CACHE_TTL_MS  = 60_000; // 60 seconds

// ─── Types ────────────────────────────────────────────────────────────────────

/** Offer with all fields required by the Menu Page for correct type detection */
interface OfferWithDetails extends Offer {
  offerType?:        string;
  comboItems?:       unknown[];
  comboPrice?:       number | null;
  condition?:        unknown;
  reward?:           unknown;
  priority?:         number;
  maxUsagePerOrder?: number;
}

interface MenuPayload {
  restaurant: Restaurant | { id: string; name: string };
  categories: Category[];
  items:      MenuItem[];
  offers:     OfferWithDetails[];
}

interface MenuCache {
  data:      MenuPayload;
  timestamp: number;
}

// Raw Firestore document shapes — typed at the boundary
interface RawCategory {
  isActive?:  boolean;
  sortOrder?: number;
  order?:     number;
  name?:      string;
  icon?:      string;
  slug?:      string;
  [key: string]: unknown;
}

interface RawProduct {
  categoryId?:     string;
  category?:       string;
  name?:           string;
  title?:          string;
  description?:    string;
  price?:          number | string;
  comparePrice?:   number | null;
  image?:          string;
  imageUrl?:       string;
  isVeg?:          boolean;
  isAvailable?:    boolean;
  isRecommended?:  boolean;
  isPopular?:      boolean;
  isTodaySpecial?: boolean;
  isFeatured?:     boolean;
  spiceLevel?:     number;
  rating?:         number;
  reviewCount?:    number;
  prepTime?:       number | null;
  calories?:       number | null;
  variants?:       unknown[];
  addons?:         unknown[];
  allergens?:      unknown[];
  ingredients?:    unknown[];
  sortOrder?:      number;
  order?:          number;
  [key: string]:   unknown;
}

interface RawOffer {
  isActive?:         boolean;
  title?:            string;
  description?:      string;
  image?:            string;
  offerType?:        string;
  discountType?:     string;
  discountValue?:    number;
  restaurantId?:     string;
  condition?:        unknown;
  reward?:           unknown;
  comboItems?:       unknown;
  comboPrice?:       number | null;
  priority?:         number;
  maxUsagePerOrder?: number;
  validFrom?:        unknown;
  validTo?:          unknown;
  [key: string]:     unknown;
}

// ─── In-memory Cache ──────────────────────────────────────────────────────────

let cache: MenuCache | null = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isCacheValid(): boolean {
  return cache !== null && Date.now() - cache.timestamp < CACHE_TTL_MS;
}

function normalizeProduct(id: string, raw: RawProduct): MenuItem {
  return {
    id,
    categoryId:     (raw.categoryId  || raw.category    || "") as string,
    name:           (raw.name        || raw.title        || "Unnamed Item") as string,
    description:    (raw.description || "") as string,
    price:          Number(raw.price || 0),
    comparePrice:   (raw.comparePrice ?? null) as number | undefined,
    image:          (raw.image       || raw.imageUrl    || "") as string,
    isVeg:          raw.isVeg          ?? true,
    isAvailable:    raw.isAvailable    ?? true,
    isRecommended:  raw.isRecommended  ?? false,
    isPopular:      raw.isPopular      ?? false,
    isTodaySpecial: raw.isTodaySpecial ?? false,
    isFeatured:     raw.isFeatured     ?? false,
    spiceLevel:     raw.spiceLevel     ?? 0,
    rating:         raw.rating         ?? 0,
    reviewCount:    raw.reviewCount    ?? 0,
    prepTime:       raw.prepTime       ?? undefined,
    calories:       raw.calories       ?? undefined,
    variants:       (raw.variants    ?? []) as MenuItem["variants"],
    addons:         (raw.addons      ?? []) as MenuItem["addons"],
    allergens:      (raw.allergens   ?? []) as string[],
    ingredients:    (raw.ingredients ?? []) as string[],
    sortOrder:      raw.sortOrder ?? raw.order ?? 0,
  };
}

function getSortOrder(raw: RawCategory | RawProduct): number {
  return (raw.sortOrder ?? raw.order ?? 0) as number;
}

/** Safely parse a field that may be stored as JSON string, array, or object */
function parseFlexibleField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (Array.isArray(value)) return value as unknown as T;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; }
    catch { return fallback; }
  }
  return fallback;
}

/**
 * Normalize a raw offer document into the full shape expected by the Menu Page.
 * Handles multiple field-name conventions (camelCase, snake_case) and JSON-string fields.
 */
function normalizeOffer(id: string, raw: RawOffer): OfferWithDetails {
  // Accept both `offerType` and possible legacy names
  const offerType = (
    raw.offerType ??
    (raw as { offer_type?: string }).offer_type ??
    (raw as { type?: string }).type ??
    "discount"
  ) as string;

  return {
    id,
    restaurantId:     (raw.restaurantId  ?? "") as string,
    title:            (raw.title         ?? "") as string,
    description:      (raw.description   ?? "") as string,
    image:            (raw.image         ?? "") as string,

    // ✅ Critical: offer type drives the entire UI behavior
    offerType,

    // Discount fields
    discountType:     (raw.discountType  ?? "percentage") as string,
    discountValue:    Number(raw.discountValue ?? 0),

    // ✅ Combo fields — parse flexibly (may be JSON string or array)
    comboItems:       parseFlexibleField<unknown[]>(raw.comboItems, []),
    comboPrice:       raw.comboPrice !== undefined && raw.comboPrice !== null
                        ? Number(raw.comboPrice)
                        : null,

    // ✅ Condition (BXGY / Free Item / Discount rules)
    condition:        parseFlexibleField<unknown>(raw.condition, null),

    // ✅ Reward (BXGY / Free Item)
    reward:           parseFlexibleField<unknown>(raw.reward, null),

    // Metadata
    priority:         Number(raw.priority         ?? 0),
    maxUsagePerOrder: Number(raw.maxUsagePerOrder ?? 1),
    isActive:         raw.isActive ?? true,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("refresh") === "1") {
    cache = null;
  }

  if (isCacheValid()) {
    return NextResponse.json(cache!.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  if (!RESTAURANT_ID) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_RESTAURANT_ID environment variable is not set" },
      { status: 500 }
    );
  }

  try {
    // Use allSettled so a failure in one collection does not crash the menu
    const [restaurantResult, categoriesResult, productsResult, offersResult] =
      await Promise.allSettled([
        getDoc(doc(db, "restaurants", RESTAURANT_ID)),
        getDocs(query(
          collection(db, "categories"),
          where("restaurantId", "==", RESTAURANT_ID)
        )),
        getDocs(query(
          collection(db, "products"),
          where("restaurantId", "==", RESTAURANT_ID)
        )),
        getDocs(query(
          collection(db, "offers"),
          where("restaurantId", "==", RESTAURANT_ID)
        )),
      ]);

    // ── Restaurant ────────────────────────────────────────────────────────────
    const restaurant: MenuPayload["restaurant"] =
      restaurantResult.status === "fulfilled" && restaurantResult.value.exists()
        ? { id: restaurantResult.value.id, ...restaurantResult.value.data() } as Restaurant
        : { id: RESTAURANT_ID, name: "Restaurant" };

    // ── Categories ────────────────────────────────────────────────────────────
    const categories: Category[] =
      categoriesResult.status === "fulfilled"
        ? categoriesResult.value.docs
            .map((d) => ({ id: d.id, ...(d.data() as RawCategory) }))
            .filter((c) => c.isActive !== false)
            .sort((a, b) => getSortOrder(a) - getSortOrder(b))
            .map((c) => ({
              id:        c.id,
              name:      (c.name      ?? "") as string,
              icon:      c.icon       as string | undefined,
              slug:      c.slug       as string | undefined,
              sortOrder: getSortOrder(c),
              isActive:  c.isActive   ?? true,
            }))
        : [];

    if (categoriesResult.status === "rejected") {
      console.error("Menu API — categories fetch failed:", categoriesResult.reason);
    }

    // ── Products ──────────────────────────────────────────────────────────────
    const items: MenuItem[] =
      productsResult.status === "fulfilled"
        ? productsResult.value.docs
            .map((d) => normalizeProduct(d.id, d.data() as RawProduct))
            .filter((p) => p.isAvailable !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        : [];

    if (productsResult.status === "rejected") {
      console.error("Menu API — products fetch failed:", productsResult.reason);
    }

    // ── Offers ────────────────────────────────────────────────────────────────
    // ✅ FIX: Return ALL offer fields (offerType, comboItems, comboPrice, condition, reward)
    // so the Menu Page can correctly render Combo / BXGY / Free Item / Discount UI.
    const offers: OfferWithDetails[] =
      offersResult.status === "fulfilled"
        ? offersResult.value.docs
            .map((d) => normalizeOffer(d.id, d.data() as RawOffer))
            .filter((o) => o.isActive !== false)
            // Highest priority first — banner shows top offer
            .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
        : [];

    if (offersResult.status === "rejected") {
      console.error("Menu API — offers fetch failed:", offersResult.reason);
    }

    const data: MenuPayload = { restaurant, categories, items, offers };

    cache = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Cache":       "MISS",
      },
    });

  } catch (error: unknown) {
    console.error("Menu API — unhandled error:", error);

    // Serve stale cache rather than a hard failure
    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { "X-Cache": "STALE" },
      });
    }

    const message = error instanceof Error
      ? error.message
      : "Failed to fetch menu data";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}