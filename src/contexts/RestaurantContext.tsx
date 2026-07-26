// src/contexts/RestaurantContext.tsx
//
// Provides restaurant data to the component tree.
// Fetches from /api/restaurant — a public endpoint that returns only
// non-sensitive restaurant info (name, logo, hours, theme).
//
// Previously called /api/admin/settings which was semantically incorrect
// for customer-facing pages.

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import type { Restaurant } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RestaurantContextValue {
  restaurant: Restaurant | null;
  loading:    boolean;
  error:      string | null;
  refetch:    () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RestaurantContext = createContext<RestaurantContextValue>({
  restaurant: null,
  loading:    true,
  error:      null,
  refetch:    () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const isMounted                   = useRef(true);

  const fetchRestaurant = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      // ✅ Use public /api/restaurant endpoint.
      // Returns only safe public fields — no financial config, no payment credentials.
      const url = RESTAURANT_ID
        ? `/api/restaurant?restaurantId=${encodeURIComponent(RESTAURANT_ID)}`
        : "/api/restaurant";

      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`Failed to load restaurant (${res.status})`);
      }

      const data = await res.json() as { restaurant?: Restaurant };

      if (isMounted.current) {
        setRestaurant(data.restaurant ?? null);
      }
    } catch (err: unknown) {
      console.error("Restaurant fetch error:", err);
      if (isMounted.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load restaurant"
        );
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    fetchRestaurant();
    return () => {
      isMounted.current = false;
    };
  }, [fetchRestaurant]);

  return (
    <RestaurantContext.Provider
      value={{ restaurant, loading, error, refetch: fetchRestaurant }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useRestaurant = () => useContext(RestaurantContext);