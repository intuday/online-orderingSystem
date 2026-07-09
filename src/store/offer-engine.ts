// src/store/offer-engine.ts
import { create } from "zustand";
import type {
  OfferRule, UnlockedOffer, PromotionalCartItem, RewardChoice,
} from "@/lib/types/offers";

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

  setOffers:           (offers: OfferRule[]) => void;
  setMenuItemsCache:   (items: CartItemForEngine[]) => void;
  evaluateCart:        (cartItems: CartItemForEngine[], menuItems: CartItemForEngine[]) => void;
  showRewardPicker:    (offer: UnlockedOffer, menuItems: CartItemForEngine[]) => void;
  claimReward:         (offerId: string, choice: RewardChoice) => void;
  removePromoItem:     (offerId: string) => void;
  dismissReward:       () => void;
  getPromoDiscount:    () => number;
  getPromoOriginalTotal: () => number;
  getPromoChargedTotal:  () => number;
  buildChoicesForOffer:  (unlocked: UnlockedOffer) => RewardChoice[];
}

function checkCondition(condition: OfferRule["condition"], cartItems: CartItemForEngine[]): boolean {
  const { requiredItemIds, requiredCategoryIds, minQuantity, minSubtotal, matchType } = condition;

  // Subtotal check
  if (minSubtotal && minSubtotal > 0) {
    const subtotal = cartItems
      .filter((i) => !i.isPromotional)
      .reduce((sum, i) => sum + i.price * i.quantity, 0);
    if (subtotal < minSubtotal) return false;
    if ((!requiredItemIds || requiredItemIds.length === 0) &&
        (!requiredCategoryIds || requiredCategoryIds.length === 0)) {
      return true;
    }
  }

  // Specific items check
  if (requiredItemIds && requiredItemIds.length > 0) {
    if (matchType === "all") {
      return requiredItemIds.every((reqId) => {
        const ci = cartItems.find((c) => c.menuItemId === reqId && !c.isPromotional);
        return ci && ci.quantity >= minQuantity;
      });
    } else {
      const totalQty = cartItems
        .filter((c) => requiredItemIds.includes(c.menuItemId) && !c.isPromotional)
        .reduce((sum, c) => sum + c.quantity, 0);
      return totalQty >= minQuantity;
    }
  }

  // Category check
  if (requiredCategoryIds && requiredCategoryIds.length > 0) {
    if (matchType === "all") {
      return requiredCategoryIds.every((catId) => {
        const qty = cartItems
          .filter((c) => c.categoryId === catId && !c.isPromotional)
          .reduce((sum, c) => sum + c.quantity, 0);
        return qty >= minQuantity;
      });
    } else {
      const totalQty = cartItems
        .filter((c) => c.categoryId && requiredCategoryIds.includes(c.categoryId) && !c.isPromotional)
        .reduce((sum, c) => sum + c.quantity, 0);
      return totalQty >= minQuantity;
    }
  }

  return false;
}

function isOfferValid(offer: OfferRule): boolean {
  if (!offer.isActive) return false;
  const now = new Date().toISOString();
  if (offer.validFrom && now < offer.validFrom) return false;
  if (offer.validTo && now > offer.validTo) return false;
  return true;
}

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

  evaluateCart: (cartItems, menuItems) => {
    const { offers, promoItems } = get();
    if (menuItems.length > 0) set({ menuItemsCache: menuItems });
    const cache = menuItems.length > 0 ? menuItems : get().menuItemsCache;

    const sortedOffers = offers
      .filter(isOfferValid)
      .filter((o) => o.offerType !== "combo") // combo alag handle hota hai
      .sort((a, b) => b.priority - a.priority);

    const newUnlocked: UnlockedOffer[] = [];

    for (const offer of sortedOffers) {
      const conditionMet = checkCondition(offer.condition, cartItems);

      if (conditionMet) {
        const alreadyClaimed = promoItems.some((pi) => pi.offerId === offer.id);

        newUnlocked.push({
          offer,
          isClaimed:     alreadyClaimed,
          claimedItemId: alreadyClaimed
            ? promoItems.find((pi) => pi.offerId === offer.id)?.menuItemId
            : undefined,
        });

        // Auto-add (sirf 1 reward item ho aur autoAdd true ho)
        if (offer.reward.autoAdd && !alreadyClaimed && offer.reward.rewardItemIds.length === 1) {
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
            set((s) => ({ promoItems: [...s.promoItems, promoItem] }));
          }
        }
      } else {
        // Condition nahi mili - promo remove karo
        const hadPromo = promoItems.find((pi) => pi.offerId === offer.id);
        if (hadPromo) {
          set((s) => ({
            promoItems:     s.promoItems.filter((pi) => pi.offerId !== offer.id),
            unlockedOffers: s.unlockedOffers.map((u) =>
              u.offer.id === offer.id ? { ...u, isClaimed: false, claimedItemId: undefined } : u
            ),
          }));
        }
      }
    }

    set({ unlockedOffers: newUnlocked });
  },

  showRewardPicker: (unlockedOffer, menuItems) => {
    const cache = menuItems.length > 0 ? menuItems : get().menuItemsCache;
    const choices: RewardChoice[] = unlockedOffer.offer.reward.rewardItemIds
      .map((itemId) => {
        const mi = cache.find((m) => m.menuItemId === itemId);
        if (!mi) return null;
        return {
          menuItemId:    mi.menuItemId,
          name:          mi.name,
          image:         mi.image,
          originalPrice: mi.price,
          promoPrice:    unlockedOffer.offer.reward.promoPrice,
          isVeg:         mi.isVeg,
        } as RewardChoice;
      })
      .filter(Boolean) as RewardChoice[];

    set({ showRewardSelector: true, activeOffer: unlockedOffer, rewardChoices: choices });
  },

  claimReward: (offerId, choice) => {
    const { activeOffer } = get();
    if (!activeOffer) return;

    const promoItem: PromotionalCartItem = {
      menuItemId:    choice.menuItemId,
      name:          choice.name,
      price:         choice.originalPrice,
      promoPrice:    choice.promoPrice,
      quantity:      1,
      image:         choice.image,
      isPromotional: true,
      offerId,
      offerTitle:    activeOffer.offer.title,
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
        u.offer.id === offerId ? { ...u, isClaimed: false, claimedItemId: undefined } : u
      ),
    }));
  },

  dismissReward: () => {
    set({ showRewardSelector: false, activeOffer: null, rewardChoices: [] });
  },

  getPromoDiscount: () => {
    return get().promoItems.reduce(
      (total, item) => total + (item.price - item.promoPrice) * item.quantity, 0
    );
  },

  getPromoOriginalTotal: () => {
    return get().promoItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getPromoChargedTotal: () => {
    return get().promoItems.reduce((sum, item) => sum + item.promoPrice * item.quantity, 0);
  },

  buildChoicesForOffer: (unlocked) => {
    const cache = get().menuItemsCache;
    return unlocked.offer.reward.rewardItemIds
      .map((itemId) => {
        const mi = cache.find((m) => m.menuItemId === itemId);
        if (!mi) return null;
        return {
          menuItemId:    mi.menuItemId,
          name:          mi.name,
          image:         mi.image,
          originalPrice: mi.price,
          promoPrice:    unlocked.offer.reward.promoPrice,
          isVeg:         mi.isVeg,
        } as RewardChoice;
      })
      .filter(Boolean) as RewardChoice[];
  },
}));