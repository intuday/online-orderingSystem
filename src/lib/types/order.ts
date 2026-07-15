// src/lib/types/order.ts

import type { Timestamp } from "firebase/firestore";
import type { Addon }     from "./menu";

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

export interface OrderItem {
  menuItemId:           string;
  name:                 string;
  price:                number;
  quantity:             number;
  variant?:             string;
  addons?:              Addon[];
  specialInstructions?: string;
  image?:               string;
}

export interface Order {
  id:             string;
  orderNumber:    string;
  tableId?:       string;
  // Table display fields — populated by API from table document
  tableName?:     string;
  tableNumber?:   string | number;
  customerId?:    string;
  customerName:   string;
  customerPhone:  string;
  items:          OrderItem[];
  subtotal:       number;
  discount:       number;
  tax:            number;
  cgst?:          number;
  sgst?:          number;
  tip:            number;
  total:          number;
  status:         OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMode?:   PaymentMode;
  isPaid?:        boolean;
  notes?:         string;
  couponCode?:    string;
  createdAt?:     Timestamp | null;
  updatedAt?:     Timestamp | null;
}