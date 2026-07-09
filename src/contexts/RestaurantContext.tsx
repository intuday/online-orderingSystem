// src/contexts/RestaurantContext.tsx
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
import type { Restaurant } from "@/lib/firebase";

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

  // ✅ ONLY API route use kar rahe hain
  // Browser se Firestore ka koi direct connection NAHI
  const fetchRestaurant = useCallback(async () => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/menu");

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

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
      value={{
        restaurant,
        loading,
        error,
        refetch: fetchRestaurant,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useRestaurant = () => useContext(RestaurantContext);