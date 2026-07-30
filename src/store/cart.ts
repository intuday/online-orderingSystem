// src/store/cart.ts
"use client";

import { create }  from "zustand";
import { persist } from "zustand/middleware";
import type { OrderItem, Addon } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "a0000000-0000-0000-0000-000000000001";

// ═════════════════════════════════════════════════════════════════════════════
// TYPES — Three Distinct Cart Entities
// ═════════════════════════════════════════════════════════════════════════════

/**
 * ENTITY 1: Regular item that the user chose to add themselves.
 * Fully editable — quantity, variant, addons, special instructions.
 * Subject to global discount offers.
 */
export type CartItem = OrderItem;

/**
 * A single line item inside a combo bundle.
 * NOT independently editable — only through parent combo operations.
 */
export interface ComboLineItem {
  menuItemId:    string;
  name:          string;
  originalPrice: number;   // MRP per unit
  image:         string;
  quantity:      number;   // Quantity per one combo unit
}

/**
 * ENTITY 2: Combo bundle — atomic unit.
 * User can only:
 *   - Change quantity of the whole combo (all items scale)
 *   - Remove entire combo (all items gone)
 * Cannot modify individual items inside.
 */
export interface CartCombo {
  comboId:       string;          // Unique cart instance ID
  offerId:       string;          // Source offer ID
  title:         string;          // e.g. "Club & Chill Combo"
  description:   string;
  image:         string;
  comboPrice:    number;          // Fixed price per one combo unit
  originalTotal: number;          // Sum of MRPs per one combo unit
  items:         ComboLineItem[];
  quantity:      number;          // How many combo units
}

/**
 * ENTITY 3: Locked reward — automatically managed by offer engine.
 * User canNOT manually add/remove/edit these.
 * Engine adds when trigger condition met, removes when condition broken.
 * User CAN dismiss (mark as declined) — stays out for this session.
 */
export interface CartReward {
  rewardId:      string;          // Unique cart instance ID
  offerId:       string;          // Source offer ID
  offerTitle:    string;          // e.g. "Buy 2 Get 1 Free"
  offerType:     "bxgy" | "free_item";
  menuItemId:    string;
  name:          string;
  image:         string;
  originalPrice: number;          // MRP for savings display
  promoPrice:    number;          // 0 = FREE, or discounted price
  quantity:      number;          // Usually 1, can scale with trigger
  isLocked:      true;            // UI marker — never editable
}

// ═════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS — Single Source of Truth for All Calculations
// ═════════════════════════════════════════════════════════════════════════════

function computeItemsSubtotal(items: CartItem[]): number {
  return items.reduce((sum, item) => {
    const addonTotal = (item.addons ?? []).reduce(
      (a: number, b: Addon) => a + b.price, 0
    );
    return sum + (item.price + addonTotal) * item.quantity;
  }, 0);
}

function computeCombosSubtotal(combos: CartCombo[]): number {
  return combos.reduce((sum, c) => sum + c.comboPrice * c.quantity, 0);
}

function computeCombosMrp(combos: CartCombo[]): number {
  return combos.reduce((sum, c) => sum + c.originalTotal * c.quantity, 0);
}

function computeRewardsSubtotal(rewards: CartReward[]): number {
  return rewards.reduce((sum, r) => sum + r.promoPrice * r.quantity, 0);
}

function computeRewardsMrp(rewards: CartReward[]): number {
  return rewards.reduce((sum, r) => sum + r.originalPrice * r.quantity, 0);
}

/**
 * Coupon revalidation after any cart change.
 * Coupon applies to items + combos subtotal (rewards are engine-managed).
 */
function resolveCouponAfterChange(
  newItems:       CartItem[],
  newCombos:      CartCombo[],
  newRewards:     CartReward[],
  couponCode:     string | null,
  discount:       number,
  couponMinOrder: number
): Partial<CartState> {
  const couponableSubtotal =
    computeItemsSubtotal(newItems) + computeCombosSubtotal(newCombos);

  if (couponCode && (couponableSubtotal <= 0 || couponableSubtotal < couponMinOrder)) {
    return {
      items:          newItems,
      combos:         newCombos,
      rewards:        newRewards,
      couponCode:     null,
      discount:       0,
      couponMinOrder: 0,
    };
  }

  if (discount > couponableSubtotal) {
    return {
      items:    newItems,
      combos:   newCombos,
      rewards:  newRewards,
      discount: Math.min(discount, couponableSubtotal),
    };
  }

  return { items: newItems, combos: newCombos, rewards: newRewards };
}

function generateId(prefix: string, sourceId: string): string {
  return `${prefix}_${sourceId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// STORE INTERFACE
// ═════════════════════════════════════════════════════════════════════════════

interface CartState {
  // ── Persisted data ──
  items:          CartItem[];
  combos:         CartCombo[];
  rewards:        CartReward[];
  dismissedRewards: string[];      // offerIds user rejected this session
  couponCode:     string | null;
  discount:       number;
  couponMinOrder: number;
  tip:            number;
  notes:          string;

  // ── Session-scoped ──
  tableId:        string | null;
  customerId:     string | null;
  customerName:   string;
  customerPhone:  string;
  restaurantId:   string;

  // ── Session actions ──
  setTable:      (id: string) => void;
  setCustomer:   (id: string, name: string, phone: string) => void;
  setRestaurant: (id: string) => void;

  // ── Regular item actions ──
  addItem:        (item: CartItem) => void;
  removeItem:     (menuItemId: string, variant?: string) => void;
  updateQuantity: (menuItemId: string, quantity: number, variant?: string) => void;

  // ── Combo actions (atomic) ──
  addCombo:            (combo: Omit<CartCombo, "comboId" | "quantity"> & { quantity?: number }) => void;
  removeCombo:         (comboId: string) => void;
  updateComboQuantity: (comboId: string, quantity: number) => void;

  // ── Reward actions (engine-managed) ──
  addReward:            (reward: Omit<CartReward, "rewardId" | "isLocked">) => void;
  removeReward:         (rewardId: string) => void;
  removeRewardByOfferId: (offerId: string) => void;
  dismissReward:        (offerId: string) => void;      // user rejects — don't re-suggest
  clearDismissedRewards: () => void;
  clearAllRewards:      () => void;                     // used by engine on full re-evaluation

  // ── Coupon / Notes / Tip ──
  setCoupon: (code: string | null, discount: number, minOrder?: number) => void;
  setTip:    (amount: number) => void;
  setNotes:  (notes: string) => void;

  // ── Lifecycle ──
  clearCart:    () => void;
  clearSession: () => void;

  // ── Computed selectors ──
  getSubtotal:          () => number;   // items + combos + rewards (all payable amounts)
  getItemsSubtotal:     () => number;   // items only (coupon-eligible)
  getCombosSubtotal:    () => number;   // combos payable amount
  getCombosMrp:         () => number;   // combos MRP (for savings)
  getCombosSavings:     () => number;
  getRewardsSubtotal:   () => number;   // rewards payable (usually 0)
  getRewardsMrp:        () => number;
  getRewardsSavings:    () => number;
  getCouponableSubtotal:() => number;   // items + combos (coupon applies here)
  getItemCount:         () => number;   // total units across all entities
  getValidDiscount:     () => number;

  // ── Helpers for offer engine ──
  hasRewardFromOffer:    (offerId: string) => boolean;
  isRewardDismissed:     (offerId: string) => boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// STORE IMPLEMENTATION
// ═════════════════════════════════════════════════════════════════════════════

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      // ── Initial State ────────────────────────────────────────────────────────
      items:            [],
      combos:           [],
      rewards:          [],
      dismissedRewards: [],
      couponCode:       null,
      discount:         0,
      couponMinOrder:   0,
      tip:              0,
      notes:            "",

      tableId:          null,
      customerId:       null,
      customerName:     "",
      customerPhone:    "",
      restaurantId:     DEFAULT_RESTAURANT_ID,

      // ── Session Actions ──────────────────────────────────────────────────────
      setTable:      (id) => set({ tableId: id }),
      setRestaurant: (id) => set({ restaurantId: id }),
      setCustomer:   (id, name, phone) =>
        set({ customerId: id, customerName: name, customerPhone: phone }),

      // ── Regular Item Actions ─────────────────────────────────────────────────
      addItem: (item) => {
        if (item.quantity <= 0) return;
        set((state) => {
          const key = `${item.menuItemId}-${item.variant ?? ""}`;
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
            (i) => !(i.menuItemId === menuItemId && (i.variant ?? "") === (variant ?? ""))
          );
          return resolveCouponAfterChange(
            newItems, state.combos, state.rewards,
            state.couponCode, state.discount, state.couponMinOrder
          );
        }),

      updateQuantity: (menuItemId, quantity, variant) =>
        set((state) => {
          const newItems =
            quantity <= 0
              ? state.items.filter(
                  (i) => !(i.menuItemId === menuItemId && (i.variant ?? "") === (variant ?? ""))
                )
              : state.items.map((i) =>
                  i.menuItemId === menuItemId && (i.variant ?? "") === (variant ?? "")
                    ? { ...i, quantity }
                    : i
                );
          return resolveCouponAfterChange(
            newItems, state.combos, state.rewards,
            state.couponCode, state.discount, state.couponMinOrder
          );
        }),

      // ── Combo Actions (Atomic) ───────────────────────────────────────────────

      /**
       * Add a combo. If same offerId combo already exists, increment quantity.
       * Otherwise create new combo instance.
       */
      addCombo: (combo) => {
        const qty = combo.quantity ?? 1;
        if (qty <= 0) return;

        set((state) => {
          const existing = state.combos.find((c) => c.offerId === combo.offerId);
          if (existing) {
            return {
              combos: state.combos.map((c) =>
                c.comboId === existing.comboId
                  ? { ...c, quantity: c.quantity + qty }
                  : c
              ),
            };
          }
          const newCombo: CartCombo = {
            ...combo,
            comboId:  generateId("combo", combo.offerId),
            quantity: qty,
          };
          return { combos: [...state.combos, newCombo] };
        });
      },

      removeCombo: (comboId) =>
        set((state) => {
          const newCombos = state.combos.filter((c) => c.comboId !== comboId);
          return resolveCouponAfterChange(
            state.items, newCombos, state.rewards,
            state.couponCode, state.discount, state.couponMinOrder
          );
        }),

      updateComboQuantity: (comboId, quantity) =>
        set((state) => {
          const newCombos =
            quantity <= 0
              ? state.combos.filter((c) => c.comboId !== comboId)
              : state.combos.map((c) =>
                  c.comboId === comboId ? { ...c, quantity } : c
                );
          return resolveCouponAfterChange(
            state.items, newCombos, state.rewards,
            state.couponCode, state.discount, state.couponMinOrder
          );
        }),

      // ── Reward Actions (Engine-Managed) ──────────────────────────────────────

      /** Add a reward. Called by offer engine only. Duplicates prevented by offerId. */
      addReward: (reward) => {
        set((state) => {
          // Skip if already added or user dismissed
          if (state.rewards.some((r) => r.offerId === reward.offerId)) return state;
          if (state.dismissedRewards.includes(reward.offerId)) return state;

          const newReward: CartReward = {
            ...reward,
            rewardId: generateId("reward", reward.offerId),
            isLocked: true,
          };
          return { rewards: [...state.rewards, newReward] };
        });
      },

      removeReward: (rewardId) =>
        set((state) => ({
          rewards: state.rewards.filter((r) => r.rewardId !== rewardId),
        })),

      removeRewardByOfferId: (offerId) =>
        set((state) => ({
          rewards: state.rewards.filter((r) => r.offerId !== offerId),
        })),

      /** User rejected this reward — don't re-add for this session */
      dismissReward: (offerId) =>
        set((state) => ({
          rewards:          state.rewards.filter((r) => r.offerId !== offerId),
          dismissedRewards: state.dismissedRewards.includes(offerId)
                              ? state.dismissedRewards
                              : [...state.dismissedRewards, offerId],
        })),

      clearDismissedRewards: () => set({ dismissedRewards: [] }),
      clearAllRewards:       () => set({ rewards: [] }),

      // ── Coupon / Tip / Notes ─────────────────────────────────────────────────
      setCoupon: (code, discount, minOrder = 0) =>
        set({
          couponCode:     code,
          discount:       code ? discount : 0,
          couponMinOrder: code ? minOrder  : 0,
        }),

      setTip:   (amount) => set({ tip: amount }),
      setNotes: (notes)  => set({ notes }),

      // ── Lifecycle ────────────────────────────────────────────────────────────
      clearCart: () =>
        set({
          items:            [],
          combos:           [],
          rewards:          [],
          dismissedRewards: [],
          couponCode:       null,
          discount:         0,
          couponMinOrder:   0,
          tip:              0,
          notes:            "",
        }),

      clearSession: () =>
        set({
          tableId:       null,
          customerId:    null,
          customerName:  "",
          customerPhone: "",
          restaurantId:  DEFAULT_RESTAURANT_ID,
        }),

      // ── Computed Selectors ───────────────────────────────────────────────────

      getSubtotal: () => {
        const s = get();
        return computeItemsSubtotal(s.items)
             + computeCombosSubtotal(s.combos)
             + computeRewardsSubtotal(s.rewards);
      },

      getItemsSubtotal:     () => computeItemsSubtotal(get().items),
      getCombosSubtotal:    () => computeCombosSubtotal(get().combos),
      getCombosMrp:         () => computeCombosMrp(get().combos),
      getCombosSavings:     () => {
        const s = get();
        return computeCombosMrp(s.combos) - computeCombosSubtotal(s.combos);
      },
      getRewardsSubtotal:   () => computeRewardsSubtotal(get().rewards),
      getRewardsMrp:        () => computeRewardsMrp(get().rewards),
      getRewardsSavings:    () => {
        const s = get();
        return computeRewardsMrp(s.rewards) - computeRewardsSubtotal(s.rewards);
      },
      getCouponableSubtotal: () => {
        const s = get();
        return computeItemsSubtotal(s.items) + computeCombosSubtotal(s.combos);
      },

      getItemCount: () => {
        const s = get();
        const itemsCount   = s.items.reduce((sum, i) => sum + i.quantity, 0);
        const combosCount  = s.combos.reduce((sum, c) => sum + c.quantity, 0);
        const rewardsCount = s.rewards.reduce((sum, r) => sum + r.quantity, 0);
        return itemsCount + combosCount + rewardsCount;
      },

      getValidDiscount: () => {
        const { discount, couponCode, couponMinOrder } = get();
        if (!couponCode) return 0;
        const couponable = get().getCouponableSubtotal();
        if (couponMinOrder > 0 && couponable < couponMinOrder) return 0;
        return Math.min(discount, couponable);
      },

      // ── Engine Helpers ───────────────────────────────────────────────────────
      hasRewardFromOffer: (offerId) =>
        get().rewards.some((r) => r.offerId === offerId),

      isRewardDismissed: (offerId) =>
        get().dismissedRewards.includes(offerId),
    }),

    {
  name:    "restaurant-cart",
  version: 2,   // ✅ bumped v1 → v2 for combos + rewards support

  // ✅ Explicit return type to satisfy Zustand's type inference
  partialize: (state): Partial<CartState> => ({
    items:            state.items,
    combos:           state.combos,
    rewards:          state.rewards,
    dismissedRewards: state.dismissedRewards,
    couponCode:       state.couponCode,
    discount:         state.discount,
    couponMinOrder:   state.couponMinOrder,
    tip:              state.tip,
    notes:            state.notes,
  }),

  /**
   * Migration from v1 (items-only) to v2 (items + combos + rewards).
   */
  migrate: (persistedState: unknown, version: number): CartState => {
    if (version < 2) {
      const old = (persistedState ?? {}) as Partial<CartState>;
      return {
        ...old,
        combos:           [],
        rewards:          [],
        dismissedRewards: [],
      } as CartState;
    }
    return persistedState as CartState;
  },
    }
  )
);