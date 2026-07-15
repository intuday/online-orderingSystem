// src/lib/types/coupon.ts
// DiscountType is the single canonical source.
// offers.ts imports DiscountType from here.

import type { Timestamp } from "firebase/firestore";

// Single canonical DiscountType — replaces the duplicate in offers.ts
export type DiscountType = "percentage" | "flat";

export interface Coupon {
  id:             string;
  code:           string;
  description?:   string;
  discountType:   DiscountType;
  discountValue:  number;
  minOrderValue?: number;
  maxDiscount?:   number;
  isActive?:      boolean;
  usageLimit?:    number;
  usageCount?:    number;
  expiresAt?:     Timestamp | null;
  createdAt?:     Timestamp | null;
}