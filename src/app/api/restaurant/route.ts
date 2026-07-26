// src/app/api/restaurant/route.ts
//
// Public restaurant profile endpoint.
// Returns non-sensitive restaurant info: name, description, logo, hours, theme.
// Used by customer-facing pages (menu, profile, etc.).
//
// No authentication required — this is public information.

import { db, doc, getDoc }  from "@/lib/firebase-admin";
import type { Restaurant }  from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// Only these fields are safe to expose publicly.
// Financial config (taxRate, gstRate) and payment credentials (upiId) are excluded.
const PUBLIC_FIELDS = new Set([
  "name",
  "description",
  "logo",
  "address",
  "phone",
  "email",
  "isOpen",
  "openingHours",
  "theme",
  "currency",
]);

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const docSnap = await getDoc(doc(db, "restaurants", restaurantId));

    // Restaurant document doesn't exist yet — return sensible defaults
    if (!docSnap.exists()) {
      const defaultRestaurant: Partial<Restaurant> = {
        id:           restaurantId,
        name:         "Restaurant",
        description:  "",
        logo:         "",
        isOpen:       true,
        currency:     "INR",
        openingHours: {},
        theme:        null,
      };

      return Response.json(
        { restaurant: defaultRestaurant },
        {
          headers: {
            // Cache for 60s at edge, revalidate in background
            "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
          },
        }
      );
    }

    // ── Filter to public fields only ────────────────────────────────────────
    // Ensures sensitive fields (gstRate, gstNumber, upiId, paymentMode,
    // acceptCash, acceptCard, taxRate) are never exposed to customers.

    const data       = docSnap.data() ?? {};
    const restaurant: Record<string, unknown> = { id: docSnap.id };

    for (const [key, value] of Object.entries(data)) {
      if (PUBLIC_FIELDS.has(key)) {
        restaurant[key] = value;
      }
    }

    return Response.json(
      { restaurant },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
        },
      }
    );

  } catch (error) {
    console.error("Restaurant public API error:", error);
    return Response.json(
      { error: "Failed to fetch restaurant data" },
      { status: 500 }
    );
  }
}