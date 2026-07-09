// src/lib/types/session.ts

export interface DiningSession {
  id:             string;
  userId:         string;
  userName:       string;
  userEmail:      string;
  userPhone:      string;
  restaurantId:   string;
  tableId:        string;
  tableNumber:    number | string;
  status:         "ACTIVE" | "ENDED" | "EXPIRED";
  startTime:      unknown;
  lastActivity:   unknown;
  expiresAt:      unknown;
  ordersCount:    number;
  totalSpent:     number;
  endedAt?:       unknown;
  endReason?:     "manual" | "timeout" | "admin" | "paid";
}

export interface SessionCreateInput {
  tableId:      string;
  restaurantId: string;
}

export interface SessionValidation {
  valid:      boolean;
  session?:   DiningSession;
  error?:     string;
}