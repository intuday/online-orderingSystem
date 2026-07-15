// src/lib/types/session.ts

import type { Timestamp } from "firebase/firestore";

export interface DiningSession {
  id:           string;
  userId:       string;
  userName:     string;
  userEmail:    string;
  userPhone:    string;
  restaurantId: string;
  tableId:      string;
  tableNumber:  number | string;
  status:       "ACTIVE" | "ENDED" | "EXPIRED";
  startTime:    Timestamp | null;
  lastActivity: Timestamp | null;
  expiresAt:    Timestamp | null;
  ordersCount:  number;
  totalSpent:   number;
  endedAt?:     Timestamp | null;
  endReason?:   "manual" | "timeout" | "admin" | "paid";
}

export interface SessionCreateInput {
  tableId:      string;
  restaurantId: string;
}

export interface SessionValidation {
  valid:    boolean;
  session?: DiningSession;
  error?:   string;
}