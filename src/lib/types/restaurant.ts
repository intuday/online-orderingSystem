// src/lib/types/restaurant.ts

import type { Timestamp } from "firebase/firestore";

export interface RestaurantTheme {
  primaryColor?:   string;
  secondaryColor?: string;
}

export interface DayHours {
  open:   string;   // e.g. "09:00"
  close:  string;   // e.g. "22:00"
  isOpen: boolean;
}

// Keys are lowercase day names: "monday" | "tuesday" | ... | "sunday"
export type OpeningHours = Record<string, DayHours>;

export interface Restaurant {
  id:            string;
  name:          string;
  logo?:         string;
  description?:  string;
  address?:      string;
  phone?:        string;
  email?:        string;
  currency?:     string;
  taxRate?:      number;
  gstRate?:      number;
  gstNumber?:    string;
  isOpen?:       boolean;
  paymentMode?:  string;
  openingHours?: OpeningHours;
  theme?:        RestaurantTheme | null;
  upiId?:        string;
  acceptCash?:   boolean;
  acceptCard?:   boolean;
  createdAt?:    Timestamp | null;
  updatedAt?:    Timestamp | null;
}

export interface Table {
  id:           string;
  number:       number;
  name:         string;
  capacity:     number;
  status:       string;
  qrCode?:      string;
  restaurantId: string;
}