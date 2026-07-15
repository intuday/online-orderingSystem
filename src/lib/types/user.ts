// src/lib/types/user.ts

import type { Timestamp } from "firebase/firestore";

export type UserRole = "customer" | "staff" | "admin" | "super_admin";

export interface UserProfile {
  uid:           string;
  email:         string | null;
  displayName:   string | null;
  photoURL:      string | null;
  phone:         string | null;
  role:          UserRole;
  restaurantId?: string;
  totalOrders?:  number;
  totalSpent?:   number;
  createdAt?:    Timestamp | null;
  updatedAt?:    Timestamp | null;
}