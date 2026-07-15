// src/lib/types/offers.ts

import type { Timestamp } from "firebase/firestore";
import type { DiscountType } from "./coupon";

// Re-export so existing imports from this file continue to work
export type { DiscountType };

export type OfferType =
  | "combo"
  | "bxgy"
  | "free_item"
  | "category_deal"
  | "discount";

export interface OfferCondition {
  requiredItemIds?:     string[];
  requiredCategoryIds?: string[];
  minQuantity:          number;
  minSubtotal?:         number;
  matchType:            "all" | "any";
}

export interface OfferReward {
  rewardItemIds:  string[];
  promoPrice:     number;
  maxQuantity:    number;
  discountType?:  DiscountType;
  discountValue?: number;
  autoAdd:        boolean;
}

export interface ComboItem {
  menuItemId:    string;
  name:          string;
  quantity:      number;
  originalPrice: number;
  image?:        string;
  isVeg?:        boolean;
}

// ─── OfferRule ────────────────────────────────────────────────────────────────
// Full engine rule stored in Firestore — used by offer-engine store.

export interface OfferRule {
  id:               string;
  restaurantId:     string;
  title:            string;
  description:      string;
  image?:           string;
  offerType:        OfferType;
  condition:        OfferCondition;
  reward:           OfferReward;
  comboItems?:      ComboItem[];
  comboPrice?:      number | null;
  isActive:         boolean;
  priority:         number;
  maxUsagePerOrder: number;
  validFrom?:       string | null;
  validTo?:         string | null;
  discountType?:    DiscountType;
  discountValue?:   number;
  createdAt?:       Timestamp | null;
  updatedAt?:       Timestamp | null;
}

// ─── Offer ────────────────────────────────────────────────────────────────────
// Lightweight display offer shown in carousel, offer modal, and offer lists.
// Distinct from OfferRule — this is the simplified API response shape.

export interface Offer {
  id:            string;
  restaurantId?: string;
  title:         string;
  description?:  string;
  image?:        string;
  discountType:  string;
  discountValue: number;
  isActive?:     boolean;
  validFrom?:    Timestamp | null;
  validTo?:      Timestamp | null;
  createdAt?:    Timestamp | null;
}

// ─── Reward & Promo ───────────────────────────────────────────────────────────

export interface UnlockedOffer {
  offer:          OfferRule;
  isClaimed:      boolean;
  claimedItemId?: string;
}

export interface PromotionalCartItem {
  menuItemId:    string;
  name:          string;
  price:         number;
  promoPrice:    number;
  quantity:      number;
  image?:        string;
  isPromotional: true;
  offerId:       string;
  offerTitle:    string;
}

export interface RewardChoice {
  menuItemId:    string;
  name:          string;
  image?:        string;
  originalPrice: number;
  promoPrice:    number;
  isVeg?:        boolean;
}