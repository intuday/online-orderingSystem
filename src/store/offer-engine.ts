// src/store/offer-engine.ts
"use client";

import { create } from "zustand";
import type {
  OfferRule,
  UnlockedOffer,
  RewardChoice,
} from "@/lib/types";
import { useCartStore } from "@/store/cart";
import type { CartReward } from "@/store/cart";

// ═════════════════════════════════════════════════════════════════════════════
// TYPES
// ═════════════════════════════════════════════════════════════════════════════

export interface CartItemForEngine {
  menuItemId:  string;
  name:        string;
  price:       number;
  quantity:    number;
  categoryId?: string;
  image?:      string;
  isVeg?:      boolean;
}

interface OfferEngineState {
  // Data
  offers:            OfferRule[];
  unlockedOffers:    UnlockedOffer[];
  menuItemsCache:    CartItemForEngine[];

  // Reward picker UI state (for offers with multiple reward choices)
  showRewardSelector: boolean;
  activeOffer:        UnlockedOffer | null;
  rewardChoices:      RewardChoice[];

  // ── Actions ──
  setOffers:            (offers: OfferRule[]) => void;
  setMenuItemsCache:    (items: CartItemForEngine[]) => void;

  /**
   * Main evaluation loop. Called on every cart change.
   * Automatically adds/removes rewards from cart store based on offer conditions.
   */
  evaluateCart: (cartItems: CartItemForEngine[], menuItems?: CartItemForEngine[]) => void;

  // Reward picker UI actions
  showRewardPicker:     (offer: UnlockedOffer, menuItems?: CartItemForEngine[]) => void;
  claimReward:          (offerId: string, choice: RewardChoice) => void;
  dismissRewardPicker:  () => void;

  // Helpers
  buildChoicesForOffer: (unlocked: UnlockedOffer) => RewardChoice[];

  // Deprecated (kept for backward-compat, do nothing)
  /** @deprecated Use cart store's rewards[] directly */
  promoItems:            never[];
  /** @deprecated Use cart store's removeRewardByOfferId */
  removePromoItem:       (offerId: string) => void;
  /** @deprecated Kept for backward-compat */
  dismissReward:         () => void;
  /** @deprecated Use cart.getRewardsSavings() */
  getPromoDiscount:      () => number;
  /** @deprecated Use cart.getRewardsMrp() */
  getPromoOriginalTotal: () => number;
  /** @deprecated Use cart.getRewardsSubtotal() */
  getPromoChargedTotal:  () => number;
}

// ═════════════════════════════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═════════════════════════════════════════════════════════════════════════════

/** Is the offer active and within its validity window? */
function isOfferValid(offer: OfferRule): boolean {
  if (!offer.isActive) return false;
  const now = new Date().toISOString();
  if (offer.validFrom && now < offer.validFrom) return false;
  if (offer.validTo   && now > offer.validTo)   return false;
  return true;
}

/**
 * Evaluates whether the current cart satisfies the offer's condition.
 * Only considers regular items + combos as trigger candidates (not rewards).
 */
function checkCondition(
  condition: OfferRule["condition"],
  cartItems: CartItemForEngine[]
): boolean {
  const {
    requiredItemIds,
    requiredCategoryIds,
    minQuantity,
    minSubtotal,
    matchType,
  } = condition;

  // Subtotal-only condition
  if (minSubtotal && minSubtotal > 0) {
    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (subtotal < minSubtotal) return false;

    // If no items/categories required either, subtotal check is enough
    if (
      (!requiredItemIds     || requiredItemIds.length     === 0) &&
      (!requiredCategoryIds || requiredCategoryIds.length === 0)
    ) {
      return true;
    }
  }

  // Specific item condition
  if (requiredItemIds && requiredItemIds.length > 0) {
    if (matchType === "all") {
      return requiredItemIds.every((reqId) => {
        const ci = cartItems.find((c) => c.menuItemId === reqId);
        return ci !== undefined && ci.quantity >= minQuantity;
      });
    }
    const totalQty = cartItems
      .filter((c) => requiredItemIds.includes(c.menuItemId))
      .reduce((sum, c) => sum + c.quantity, 0);
    return totalQty >= minQuantity;
  }

  // Category condition
  if (requiredCategoryIds && requiredCategoryIds.length > 0) {
    if (matchType === "all") {
      return requiredCategoryIds.every((catId) => {
        const qty = cartItems
          .filter((c) => c.categoryId === catId)
          .reduce((sum, c) => sum + c.quantity, 0);
        return qty >= minQuantity;
      });
    }
    const totalQty = cartItems
      .filter((c) => c.categoryId && requiredCategoryIds.includes(c.categoryId))
      .reduce((sum, c) => sum + c.quantity, 0);
    return totalQty >= minQuantity;
  }

  return false;
}

/**
 * Build reward choices from menu cache for a given unlocked offer.
 */
function buildRewardChoices(
  unlocked: UnlockedOffer,
  cache:    CartItemForEngine[]
): RewardChoice[] {
  return unlocked.offer.reward.rewardItemIds
    .map((itemId): RewardChoice | null => {
      const mi = cache.find((m) => m.menuItemId === itemId);
      if (!mi) return null;
      return {
        menuItemId:    mi.menuItemId,
        name:          mi.name,
        image:         mi.image,
        originalPrice: mi.price,
        promoPrice:    unlocked.offer.reward.promoPrice,
        isVeg:         mi.isVeg,
      };
    })
    .filter((c): c is RewardChoice => c !== null);
}

/**
 * Add a single reward directly to the cart store.
 */
function addRewardToCart(
  offer:  OfferRule,
  choice: RewardChoice,
  quantity = 1
): void {
  const cart = useCartStore.getState();

  // Skip if already there or user dismissed
  if (cart.hasRewardFromOffer(offer.id)) return;
  if (cart.isRewardDismissed(offer.id))  return;

  cart.addReward({
    offerId:       offer.id,
    offerTitle:    offer.title,
    offerType:     (offer.offerType === "free_item" ? "free_item" : "bxgy"),
    menuItemId:    choice.menuItemId,
    name:          choice.name,
    image:         choice.image ?? "",
    originalPrice: choice.originalPrice,
    promoPrice:    choice.promoPrice,
    quantity,
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// STORE
// ═════════════════════════════════════════════════════════════════════════════

export const useOfferEngine = create<OfferEngineState>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  offers:             [],
  unlockedOffers:     [],
  menuItemsCache:     [],
  showRewardSelector: false,
  activeOffer:        null,
  rewardChoices:      [],

  // Deprecated fields (kept for old code references)
  promoItems: [] as never[],

  // ── Setters ────────────────────────────────────────────────────────────────
  setOffers:         (offers) => set({ offers }),
  setMenuItemsCache: (items)  => set({ menuItemsCache: items }),

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN EVALUATION — Runs on every cart change
  // ═══════════════════════════════════════════════════════════════════════════
  /**
   * Evaluates all active BXGY / Free Item offers against the current cart.
   *
   * Behavior:
   *   1. For each qualifying offer with SINGLE reward option → auto-add reward
   *   2. For each qualifying offer with MULTIPLE reward options → mark unlocked (user picks via UI)
   *   3. For offers whose condition is no longer met → auto-remove their reward
   *   4. Dismissed rewards (user rejected) are never re-added in same session
   *   5. Combo offers are excluded (user-triggered, not auto)
   *   6. Simple discount offers are excluded (bill-level, no reward)
   */
  evaluateCart: (cartItems, menuItems) => {
    const state = get();

    // Refresh menu cache if fresh data provided
    const cache = (menuItems && menuItems.length > 0) ? menuItems : state.menuItemsCache;
    if (menuItems && menuItems.length > 0 && menuItems !== state.menuItemsCache) {
      set({ menuItemsCache: cache });
    }

    // Only evaluate BXGY / free_item offers (combo & discount handled elsewhere)
    const rewardOffers = state.offers
      .filter(isOfferValid)
      .filter((o) => o.offerType === "bxgy" || o.offerType === "free_item")
      .sort((a, b) => b.priority - a.priority);

    const cart = useCartStore.getState();
    const newUnlocked: UnlockedOffer[] = [];

    for (const offer of rewardOffers) {
      const conditionMet = checkCondition(offer.condition, cartItems);
      const currentlyInCart = cart.hasRewardFromOffer(offer.id);
      const dismissed = cart.isRewardDismissed(offer.id);

      if (conditionMet) {
        // Build reward choices
        const choices = offer.reward.rewardItemIds
          .map((id) => cache.find((m) => m.menuItemId === id))
          .filter((m): m is CartItemForEngine => m !== undefined);

        if (choices.length === 0) continue; // reward items not in menu

        const isClaimed = currentlyInCart;

        newUnlocked.push({
          offer,
          isClaimed,
          claimedItemId: isClaimed
            ? cart.rewards.find((r) => r.offerId === offer.id)?.menuItemId
            : undefined,
        });

        // Auto-add reward if:
        //  - Only one choice (no user pick needed)
        //  - Not already in cart
        //  - Not dismissed by user
        //  - Offer.autoAdd is true OR only single reward option exists
        const shouldAutoAdd =
          !currentlyInCart &&
          !dismissed &&
          choices.length === 1 &&
          (offer.reward.autoAdd !== false);   // default true if single choice

        if (shouldAutoAdd) {
          const only = choices[0];
          addRewardToCart(
            offer,
            {
              menuItemId:    only.menuItemId,
              name:          only.name,
              image:         only.image,
              originalPrice: only.price,
              promoPrice:    offer.reward.promoPrice,
              isVeg:         only.isVeg,
            },
            1
          );
        }
      } else {
        // Condition broken → remove reward if present
        if (currentlyInCart) {
          cart.removeRewardByOfferId(offer.id);
        }
      }
    }

    // Cleanup: remove any rewards in cart whose offer no longer qualifies
    // or no longer exists in active offers list
    const activeOfferIds = new Set(newUnlocked.map((u) => u.offer.id));
    for (const reward of cart.rewards) {
      if (!activeOfferIds.has(reward.offerId)) {
        cart.removeRewardByOfferId(reward.offerId);
      }
    }

    set({ unlockedOffers: newUnlocked });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REWARD PICKER UI (for offers with multiple reward choices)
  // ═══════════════════════════════════════════════════════════════════════════

  showRewardPicker: (unlockedOffer, menuItems) => {
    const cache   = menuItems && menuItems.length > 0 ? menuItems : get().menuItemsCache;
    const choices = buildRewardChoices(unlockedOffer, cache);
    set({
      showRewardSelector: true,
      activeOffer:        unlockedOffer,
      rewardChoices:      choices,
    });
  },

  /**
   * User selected a reward choice → add to cart.
   */
  claimReward: (offerId, choice) => {
    const state    = get();
    const unlocked = state.unlockedOffers.find((u) => u.offer.id === offerId);
    if (!unlocked) {
      // Close picker even if offer stale
      set({ showRewardSelector: false, activeOffer: null, rewardChoices: [] });
      return;
    }

    // Remove any previous reward from same offer first (in case of choice swap)
    const cart = useCartStore.getState();
    if (cart.hasRewardFromOffer(offerId)) {
      cart.removeRewardByOfferId(offerId);
    }

    addRewardToCart(unlocked.offer, choice, 1);

    // Update unlocked state
    set((s) => ({
      showRewardSelector: false,
      activeOffer:        null,
      rewardChoices:      [],
      unlockedOffers:     s.unlockedOffers.map((u) =>
        u.offer.id === offerId
          ? { ...u, isClaimed: true, claimedItemId: choice.menuItemId }
          : u
      ),
    }));
  },

  /** Close reward picker without claiming */
  dismissRewardPicker: () => {
    set({ showRewardSelector: false, activeOffer: null, rewardChoices: [] });
  },

  buildChoicesForOffer: (unlocked) =>
    buildRewardChoices(unlocked, get().menuItemsCache),

  // ═══════════════════════════════════════════════════════════════════════════
  // DEPRECATED — kept for backward compat with any old callers
  // ═══════════════════════════════════════════════════════════════════════════

  removePromoItem: (offerId) => {
    useCartStore.getState().removeRewardByOfferId(offerId);
  },

  dismissReward: () => {
    // Old API — just close the picker
    set({ showRewardSelector: false, activeOffer: null, rewardChoices: [] });
  },

  getPromoDiscount:      () => useCartStore.getState().getRewardsSavings(),
  getPromoOriginalTotal: () => useCartStore.getState().getRewardsMrp(),
  getPromoChargedTotal:  () => useCartStore.getState().getRewardsSubtotal(),
}));