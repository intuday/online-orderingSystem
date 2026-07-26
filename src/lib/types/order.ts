// src/lib/types/order.ts

import type { Timestamp } from "firebase/firestore";
import type { Addon }     from "./menu";

// ─── Enums ────────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "served"
  | "delivered"
  | "completed"
  | "cancelled";

export type PaymentStatus = "unpaid" | "paid" | "refunded" | "failed";

export type PaymentMode = "cash" | "card" | "upi" | "online";

// ─── Order Item ───────────────────────────────────────────────────────────────

export interface OrderItem {
  menuItemId:           string;
  name:                 string;
  price:                number;
  originalPrice?:       number;
  promoPrice?:          number | null;
  quantity:             number;
  variant?:             string;
  addons?:              Addon[];
  specialInstructions?: string;
  image?:               string;
  isPromotional?:       boolean;
  offerId?:             string | null;
  offerTitle?:          string | null;
}

// ─── Order ────────────────────────────────────────────────────────────────────

export interface Order {
  // ── Identifiers ─────────────────────────────────────────────────────────────
  id:              string;
  orderNumber:     string;
  restaurantId?:   string;

  // ── Table info ──────────────────────────────────────────────────────────────
  tableId?:        string;
  tableName?:      string;
  tableNumber?:    string | number;

  // ── Session tracking ────────────────────────────────────────────────────────
  sessionId?:      string | null;

  // ── Customer info ───────────────────────────────────────────────────────────
  customerId?:     string | null;
  customerName:    string;
  customerPhone:   string;

  // ── Items ───────────────────────────────────────────────────────────────────
  items:           OrderItem[];

  // ── Money ───────────────────────────────────────────────────────────────────
  subtotal:        number;
  discount:        number;
  couponDiscount?: number;
  promoDiscount?:  number;
  tax:             number;
  taxAmount?:      number;
  cgst?:           number;
  sgst?:           number;
  tip:             number;
  total:           number;

  // ── Status ──────────────────────────────────────────────────────────────────
  status:          OrderStatus;
  paymentStatus?:  PaymentStatus;
  paymentMode?:    PaymentMode;
  isPaid?:         boolean;

  // ── Notes & coupon ──────────────────────────────────────────────────────────
  notes?:          string;
  couponCode?:     string | null;

  // ── Audit ───────────────────────────────────────────────────────────────────
  updatedByUid?:   string;
  createdAt?:      Timestamp | null;
  updatedAt?:      Timestamp | null;
  paidAt?:         Timestamp | null;
}