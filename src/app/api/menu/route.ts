// src/app/api/menu/route.ts
import { NextResponse } from "next/server";
import {
  db,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "@/lib/firebase-admin";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 60_000;

// ✅ Cache clear karne ka function - dusre routes use kar sakte hain
export function clearMenuCache() {
  cache = null;
}

export async function GET(request: Request) {
  // ✅ ?refresh=1 se cache force clear hoga
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "1";

  if (forceRefresh) {
    cache = null;
  }

  if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  try {
    if (!RESTAURANT_ID) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_RESTAURANT_ID not set" },
        { status: 500 }
      );
    }

    const [restaurantSnap, categoriesSnap, productsSnap, offersSnap] =
      await Promise.all([
        getDoc(doc(db, "restaurants", RESTAURANT_ID)),

        getDocs(
          query(
            collection(db, "categories"),
            where("restaurantId", "==", RESTAURANT_ID)
          )
        ),

        getDocs(
          query(
            collection(db, "products"),
            where("restaurantId", "==", RESTAURANT_ID)
          )
        ),

        getDocs(
          query(
            collection(db, "offers"),
            where("restaurantId", "==", RESTAURANT_ID)
          )
        ),
      ]);

    const categories = categoriesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c: any) => c.isActive !== false)
      .sort(
        (a: any, b: any) =>
          (a.sortOrder ?? a.order ?? 0) - (b.sortOrder ?? b.order ?? 0)
      );

    const items = productsSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p: any) => p.isAvailable !== false)
      .sort(
        (a: any, b: any) =>
          (a.sortOrder ?? a.order ?? 0) - (b.sortOrder ?? b.order ?? 0)
      )
      .map((p: any) => ({
        id:             p.id,
        categoryId:     p.categoryId    || p.category  || "",
        name:           p.name          || p.title     || "Unnamed Item",
        description:    p.description   || "",
        price:          Number(p.price  || 0),
        comparePrice:   p.comparePrice  ?? null,
        image:          p.image         || p.imageUrl  || "",
        isVeg:          p.isVeg         ?? true,
        isAvailable:    p.isAvailable   ?? true,
        isRecommended:  p.isRecommended ?? false,
        isPopular:      p.isPopular     ?? false,
        isTodaySpecial: p.isTodaySpecial ?? false,
        isFeatured:     p.isFeatured    ?? false,
        spiceLevel:     p.spiceLevel    ?? 0,
        rating:         p.rating        ?? 0,
        reviewCount:    p.reviewCount   ?? 0,
        prepTime:       p.prepTime      ?? null,
        calories:       p.calories      ?? null,
        variants:       p.variants      ?? [],
        addons:         p.addons        ?? [],
        allergens:      p.allergens     ?? [],
        ingredients:    p.ingredients   ?? [],
      }));

    const offers = offersSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((o: any) => o.isActive !== false);

    const restaurant = restaurantSnap.exists()
      ? { id: restaurantSnap.id, ...restaurantSnap.data() }
      : { id: RESTAURANT_ID, name: "Restaurant" };

    const data = { restaurant, categories, items, offers };

    cache = { data, timestamp: Date.now() };

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        "X-Cache": "MISS",
      },
    });
  } catch (error: unknown) {
    console.error("Menu API error:", error);

    if (cache) {
      return NextResponse.json(cache.data, {
        headers: { "X-Cache": "STALE" },
      });
    }

    const message =
      error instanceof Error ? error.message : "Failed to fetch menu";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}