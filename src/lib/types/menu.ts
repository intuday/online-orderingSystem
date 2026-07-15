// src/lib/types/menu.ts
// Canonical menu types — used by both client (firebase.ts) and
// server (firebase-admin.ts). Single source of truth.

import type { Timestamp } from "firebase/firestore";

export interface Category {
  id:        string;
  name:      string;
  icon?:     string;
  sortOrder?: number;
  slug?:     string;
  isActive?: boolean;
}

export interface Variant {
  name:  string;
  price: number;
}

export interface Addon {
  name:  string;
  price: number;
}

export interface MenuItem {
  id:              string;
  restaurantId?:   string;
  categoryId:      string;
  name:            string;
  slug?:           string;
  description?:    string;
  price:           number;
  comparePrice?:   number;
  image?:          string;
  isVeg?:          boolean;
  isAvailable?:    boolean;
  isRecommended?:  boolean;
  isPopular?:      boolean;
  isTodaySpecial?: boolean;
  isFeatured?:     boolean;
  spiceLevel?:     number;
  rating?:         number;
  reviewCount?:    number;
  orderCount?:     number;
  prepTime?:       number;
  calories?:       number;
  sortOrder?:      number;
  variants?:       Variant[];
  addons?:         Addon[];
  allergens?:      string[];
  ingredients?:    string[];
  createdAt?:      Timestamp | null;
  updatedAt?:      Timestamp | null;
}