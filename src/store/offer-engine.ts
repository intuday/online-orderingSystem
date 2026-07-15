// src/store/offer-engine.ts
import { create } from "zustand";
import type {
  OfferRule,
  UnlockedOffer,
  PromotionalCartItem,
  RewardChoice,
} from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CartItemForEngine {
  menuItemId:     string;
  name:           string;
  price:          number;
  quantity:       number;
  categoryId?:    string;
  image?:         string;
  isVeg?:         boolean;
  isPromotional?: boolean;
  offerId?:       string;
}

interface OfferEngineState {
  offers:             OfferRule[];
  unlockedOffers:     UnlockedOffer[];
  promoItems:         PromotionalCartItem[];
  showRewardSelector: boolean;
  activeOffer:        UnlockedOffer | null;
  rewardChoices:      RewardChoice[];
  menuItemsCache:     CartItemForEngine[];

  setOffers:             (offers: OfferRule[]) => void;
  setMenuItemsCache:     (items: CartItemForEngine[]) => void;
  evaluateCart:          (cartItems: CartItemForEngine[], menuItems: CartItemForEngine[]) => void;
  showRewardPicker:      (offer: UnlockedOffer, menuItems: CartItemForEngine[]) => void;
  claimReward:           (offerId: string, choice: RewardChoice) => void;
  removePromoItem:       (offerId: string) => void;
  dismissReward:         () => void;
  getPromoDiscount:      () => number;
  getPromoOriginalTotal: () => number;
  getPromoChargedTotal:  () => number;
  buildChoicesForOffer:  (unlocked: UnlockedOffer) => RewardChoice[];
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

/**
 * Checks whether the offer condition is satisfied by the current cart.
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

  const regularItems = cartItems.filter((i) => !i.isPromotional);

  // Subtotal-only condition
  if (minSubtotal && minSubtotal > 0) {
    const subtotal = regularItems.reduce(
      (sum, i) => sum + i.price * i.quantity,
      0
    );
    if (subtotal < minSubtotal) return false;

    // If no specific items/categories required, subtotal check is sufficient
    if (
      (!requiredItemIds    || requiredItemIds.length    === 0) &&
      (!requiredCategoryIds || requiredCategoryIds.length === 0)
    ) {
      return true;
    }
  }

  // Specific item condition
  if (requiredItemIds && requiredItemIds.length > 0) {
    if (matchType === "all") {
      return requiredItemIds.every((reqId) => {
        const ci = regularItems.find((c) => c.menuItemId === reqId);
        return ci && ci.quantity >= minQuantity;
      });
    }
    const totalQty = regularItems
      .filter((c) => requiredItemIds.includes(c.menuItemId))
      .reduce((sum, c) => sum + c.quantity, 0);
    return totalQty >= minQuantity;
  }

  // Category condition
  if (requiredCategoryIds && requiredCategoryIds.length > 0) {
    if (matchType === "all") {
      return requiredCategoryIds.every((catId) => {
        const qty = regularItems
          .filter((c) => c.categoryId === catId)
          .reduce((sum, c) => sum + c.quantity, 0);
        return qty >= minQuantity;
      });
    }
    const totalQty = regularItems
      .filter((c) => c.categoryId && requiredCategoryIds.includes(c.categoryId))
      .reduce((sum, c) => sum + c.quantity, 0);
    return totalQty >= minQuantity;
  }

  return false;
}

/**
 * Returns true if the offer is active and within its validity window.
 */
function isOfferValid(offer: OfferRule): boolean {
  if (!offer.isActive) return false;
  const now = new Date().toISOString();
  if (offer.validFrom && now < offer.validFrom) return false;
  if (offer.validTo   && now > offer.validTo)   return false;
  return true;
}

/**
 * Builds reward choices for an unlocked offer from the menu cache.
 * Single source of truth — used by showRewardPicker and buildChoicesForOffer.
 */
function buildRewardChoices(
  unlocked:  UnlockedOffer,
  cache:     CartItemForEngine[]
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

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOfferEngine = create<OfferEngineState>((set, get) => ({
  offers:             [],
  unlockedOffers:     [],
  promoItems:         [],
  showRewardSelector: false,
  activeOffer:        null,
  rewardChoices:      [],
  menuItemsCache:     [],

  setOffers:         (offers) => set({ offers }),
  setMenuItemsCache: (items)  => set({ menuItemsCache: items }),

  /**
   * Evaluates the current cart against all active offers.
   *
   * NOTE: Combo offers (offerType === "combo") are intentionally excluded
   * from automated evaluation. They are handled manually via OfferDetailModal
   * where the user explicitly adds the combo to their cart.
   *
   * All state mutations are batched into a single set() call at the end
   * to avoid multiple re-renders per cart update.
   */
  evaluateCart: (cartItems, menuItems) => {
    const state = get();

    // Update cache if fresh menu data provided
    const cache = menuItems.length > 0 ? menuItems : state.menuItemsCache;
    if (menuItems.length > 0 && menuItems !== state.menuItemsCache) {
      set({ menuItemsCache: cache });
    }

    // Work on a mutable copy of promoItems to avoid stale closure reads
    let currentPromoItems = [...state.promoItems];

    const sortedOffers = state.offers
      .filter(isOfferValid)
      .filter((o) => o.offerType !== "combo")
      .sort((a, b) => b.priority - a.priority);

    const newUnlocked: UnlockedOffer[] = [];

    for (const offer of sortedOffers) {
      const conditionMet = checkCondition(offer.condition, cartItems);

      if (conditionMet) {
        const existingPromo = currentPromoItems.find(
          (pi) => pi.offerId === offer.id
        );
        const alreadyClaimed = Boolean(existingPromo);

        newUnlocked.push({
          offer,
          isClaimed:     alreadyClaimed,
          claimedItemId: existingPromo?.menuItemId,
        });

        // Auto-add single reward item if configured and not yet claimed
        if (
          offer.reward.autoAdd &&
          !alreadyClaimed &&
          offer.reward.rewardItemIds.length === 1
        ) {
          const rewardId = offer.reward.rewardItemIds[0];
          const menuItem = cache.find((mi) => mi.menuItemId === rewardId);

          if (menuItem) {
            const promoItem: PromotionalCartItem = {
              menuItemId:    menuItem.menuItemId,
              name:          menuItem.name,
              price:         menuItem.price,
              promoPrice:    offer.reward.promoPrice,
              quantity:      1,
              image:         menuItem.image,
              isPromotional: true,
              offerId:       offer.id,
              offerTitle:    offer.title,
            };
            // Mutate local copy — not state yet
            currentPromoItems = [...currentPromoItems, promoItem];
          }
        }
      } else {
        // Condition no longer met — remove any promo item for this offer
        currentPromoItems = currentPromoItems.filter(
          (pi) => pi.offerId !== offer.id
        );
      }
    }

    // Single batched state update — no multiple re-renders
    set({
      unlockedOffers: newUnlocked,
      promoItems:     currentPromoItems,
    });
  },

  showRewardPicker: (unlockedOffer, menuItems) => {
    const cache   = menuItems.length > 0 ? menuItems : get().menuItemsCache;
    const choices = buildRewardChoices(unlockedOffer, cache);
    set({
      showRewardSelector: true,
      activeOffer:        unlockedOffer,
      rewardChoices:      choices,
    });
  },

  claimReward: (offerId, choice) => {
    const { unlockedOffers } = get();

    // Look up offer title from unlockedOffers — do not rely on activeOffer
    // which may be null if dismissed between call and execution
    const unlocked   = unlockedOffers.find((u) => u.offer.id === offerId);
    const offerTitle = unlocked?.offer.title ?? "";

    const promoItem: PromotionalCartItem = {
      menuItemId:    choice.menuItemId,
      name:          choice.name,
      price:         choice.originalPrice,
      promoPrice:    choice.promoPrice,
      quantity:      1,
      image:         choice.image,
      isPromotional: true,
      offerId,
      offerTitle,
    };

    set((s) => ({
      promoItems:         [...s.promoItems, promoItem],
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

  removePromoItem: (offerId) => {
    set((s) => ({
      promoItems:     s.promoItems.filter((pi) => pi.offerId !== offerId),
      unlockedOffers: s.unlockedOffers.map((u) =>
        u.offer.id === offerId
          ? { ...u, isClaimed: false, claimedItemId: undefined }
          : u
      ),
    }));
  },

  dismissReward: () => {
    set({ showRewardSelector: false, activeOffer: null, rewardChoices: [] });
  },

  getPromoDiscount: () =>
    get().promoItems.reduce(
      (total, item) => total + (item.price - item.promoPrice) * item.quantity,
      0
    ),

  getPromoOriginalTotal: () =>
    get().promoItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    ),

  getPromoChargedTotal: () =>
    get().promoItems.reduce(
      (sum, item) => sum + item.promoPrice * item.quantity,
      0
    ),

  buildChoicesForOffer: (unlocked) =>
    buildRewardChoices(unlocked, get().menuItemsCache),
}));