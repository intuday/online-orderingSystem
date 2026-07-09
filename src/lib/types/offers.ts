// src/lib/types/offers.ts

export type OfferType =
  | "combo"
  | "bxgy"
  | "free_item"
  | "category_deal"
  | "discount";

export type DiscountType = "percentage" | "flat";

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
  discountType?:    string;
  discountValue?:   number;
  createdAt?:       unknown;
  updatedAt?:       unknown;
}

// ✅ uid BILKUL NAHI - remove kiya
export interface UnlockedOffer {
  offer:          OfferRule;
  isClaimed:      boolean;
  claimedItemId?: string;
}

// ✅ uid BILKUL NAHI - remove kiya
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