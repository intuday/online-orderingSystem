// src/lib/types/index.ts
// Central re-export for all domain types.
// Always import types from "@/lib/types" — never from individual files
// or from "@/lib/firebase" / "@/lib/firebase-admin".

export type { UserRole, UserProfile }                          from "./user";
export type { RestaurantTheme, DayHours, OpeningHours,
              Restaurant, Table }                              from "./restaurant";
export type { Category, Variant, Addon, MenuItem }             from "./menu";
export type { OrderStatus, PaymentStatus, PaymentMode,
              OrderItem, Order }                               from "./order";
export type { DiscountType, Coupon }                           from "./coupon";
export type { OfferType, OfferCondition, OfferReward,
              ComboItem, OfferRule, Offer, UnlockedOffer,
              PromotionalCartItem, RewardChoice }              from "./offers";
export type { DiningSession, SessionCreateInput,
              SessionValidation }                              from "./session";