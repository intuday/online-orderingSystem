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

interface MenuPayload {
  restaurant: Restaurant | { id: string; name: string };
  categories: Category[];
  items:      MenuItem[];
  offers:     Offer[];
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
  isActive?:      boolean;
  title?:         string;
  description?:   string;
  image?:         string;
  discountType?:  string;
  discountValue?: number;
  restaurantId?:  string;
  [key: string]:  unknown;
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
    const offers: Offer[] =
      offersResult.status === "fulfilled"
        ? offersResult.value.docs
            .map((d) => ({ id: d.id, ...(d.data() as RawOffer) }))
            .filter((o) => o.isActive !== false)
            .map((o) => ({
              id:            o.id,
              restaurantId:  o.restaurantId  as string | undefined,
              title:         (o.title        ?? "") as string,
              description:   o.description   as string | undefined,
              image:         o.image         as string | undefined,
              discountType:  (o.discountType  ?? "percentage") as string,
              discountValue: (o.discountValue ?? 0) as number,
              isActive:      o.isActive       ?? true,
            }))
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