// src/store/cart.ts
"use client";

import { create }   from "zustand";
import { persist }  from "zustand/middleware";
import type { OrderItem, Addon } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "a0000000-0000-0000-0000-000000000001";

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Calculates the subtotal for a list of cart items.
 * Single source of truth — used by removeItem, updateQuantity, and getSubtotal.
 */
function computeSubtotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    const addonTotal = (item.addons ?? []).reduce(
      (a: number, b: Addon) => a + b.price,
      0
    );
    return sum + (item.price + addonTotal) * item.quantity;
  }, 0);
}

/**
 * Returns the coupon-related state updates needed after items change.
 * Centralizes coupon invalidation logic — removes duplication from
 * removeItem and updateQuantity.
 */
function resolveCouponAfterItemChange(
  newItems:       OrderItem[],
  couponCode:     string | null,
  discount:       number,
  couponMinOrder: number
): Partial<CartState> {
  const newSubtotal = computeSubtotal(newItems);

  // Subtotal is zero or below minimum order → invalidate coupon entirely
  if (couponCode && (newSubtotal <= 0 || newSubtotal < couponMinOrder)) {
    return {
      items:          newItems,
      couponCode:     null,
      discount:       0,
      couponMinOrder: 0,
    };
  }

  // Discount exceeds new subtotal → cap it
  if (discount > newSubtotal) {
    return {
      items:    newItems,
      discount: Math.min(discount, newSubtotal),
    };
  }

  return { items: newItems };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartState {
  // ── Persisted data (safe to save across sessions) ──
  items:          OrderItem[];
  couponCode:     string | null;
  discount:       number;
  couponMinOrder: number;
  tip:            number;
  notes:          string;

  // ── Session-scoped data (NOT persisted — must come fresh each visit) ──
  tableId:        string | null;
  customerId:     string | null;
  customerName:   string;
  customerPhone:  string;
  restaurantId:   string;

  // ── Actions ──
  setTable:         (id: string) => void;
  setCustomer:      (id: string, name: string, phone: string) => void;
  setRestaurant:    (id: string) => void;
  addItem:          (item: OrderItem) => void;
  removeItem:       (menuItemId: string, variant?: string) => void;
  updateQuantity:   (menuItemId: string, quantity: number, variant?: string) => void;
  setCoupon:        (code: string | null, discount: number, minOrder?: number) => void;
  setTip:           (amount: number) => void;
  setNotes:         (notes: string) => void;
  clearCart:        () => void;
  clearSession:     () => void;

  // ── Computed ──
  getSubtotal:      () => number;
  getItemCount:     () => number;
  getValidDiscount: () => number;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // ── Initial State ────────────────────────────────────────────────────────
      items:          [],
      couponCode:     null,
      discount:       0,
      couponMinOrder: 0,
      tip:            0,
      notes:          "",

      // Session-scoped fields — reset on every fresh browser load
      tableId:        null,
      customerId:     null,
      customerName:   "",
      customerPhone:  "",
      restaurantId:   DEFAULT_RESTAURANT_ID,

      // ── Actions ──────────────────────────────────────────────────────────────

      setTable:      (id) => set({ tableId: id }),
      setRestaurant: (id) => set({ restaurantId: id }),
      setCustomer:   (id, name, phone) =>
        set({ customerId: id, customerName: name, customerPhone: phone }),

      addItem: (item) => {
        // Guard: do not add zero or negative quantity items
        if (item.quantity <= 0) return;

        set((state) => {
          const key      = `${item.menuItemId}-${item.variant ?? ""}`;
          const existing = state.items.find(
            (i) => `${i.menuItemId}-${i.variant ?? ""}` === key
          );

          if (existing) {
            return {
              items: state.items.map((i) =>
                `${i.menuItemId}-${i.variant ?? ""}` === key
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }

          return { items: [...state.items, item] };
        });
      },

      removeItem: (menuItemId, variant) =>
        set((state) => {
          const newItems = state.items.filter(
            (i) =>
              !(i.menuItemId === menuItemId &&
                (i.variant ?? "") === (variant ?? ""))
          );
          return resolveCouponAfterItemChange(
            newItems,
            state.couponCode,
            state.discount,
            state.couponMinOrder
          );
        }),

      updateQuantity: (menuItemId, quantity, variant) =>
        set((state) => {
          const newItems =
            quantity <= 0
              ? state.items.filter(
                  (i) =>
                    !(i.menuItemId === menuItemId &&
                      (i.variant ?? "") === (variant ?? ""))
                )
              : state.items.map((i) =>
                  i.menuItemId === menuItemId &&
                  (i.variant ?? "") === (variant ?? "")
                    ? { ...i, quantity }
                    : i
                );

          return resolveCouponAfterItemChange(
            newItems,
            state.couponCode,
            state.discount,
            state.couponMinOrder
          );
        }),

      setCoupon: (code, discount, minOrder = 0) =>
        set({
          couponCode:     code,
          discount:       code ? discount : 0,
          couponMinOrder: code ? minOrder  : 0,
        }),

      setTip:   (amount) => set({ tip: amount }),
      setNotes: (notes)  => set({ notes }),

      clearCart: () =>
        set({
          items:          [],
          couponCode:     null,
          discount:       0,
          couponMinOrder: 0,
          tip:            0,
          notes:          "",
        }),

      /**
       * Clears session-scoped fields (table + customer info).
       * Used on logout so a fresh user doesn't inherit stale session data.
       * Does NOT clear items — those are user's own selections.
       */
      clearSession: () =>
        set({
          tableId:       null,
          customerId:    null,
          customerName:  "",
          customerPhone: "",
          restaurantId:  DEFAULT_RESTAURANT_ID,
        }),

      // ── Computed ─────────────────────────────────────────────────────────────

      getSubtotal: () => computeSubtotal(get().items),

      getItemCount: () =>
        get().items.reduce((sum, item) => sum + item.quantity, 0),

      getValidDiscount: () => {
        const { discount, couponCode, couponMinOrder, items } = get();
        if (!couponCode) return 0;

        const subtotal = computeSubtotal(items);

        // Subtotal below minimum order → no discount
        if (couponMinOrder > 0 && subtotal < couponMinOrder) return 0;

        // Cap discount at subtotal
        return Math.min(discount, subtotal);
      },
    }),

    {
      name: "restaurant-cart",

      // ✅ Only persist cart items and preferences.
      // Session-scoped fields (tableId, customerId, customerName, customerPhone,
      // restaurantId) are intentionally EXCLUDED so they must come from a fresh
      // QR scan + auth session each time. Prevents stale table binding and
      // cross-session data leaks.
      partialize: (state) => ({
        items:          state.items,
        couponCode:     state.couponCode,
        discount:       state.discount,
        couponMinOrder: state.couponMinOrder,
        tip:            state.tip,
        notes:          state.notes,
      }),
    }
  )
);