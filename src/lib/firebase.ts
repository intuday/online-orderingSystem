import { initializeApp, getApps, getApp } from "firebase/app";
import {
  
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app            = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth           = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export {
  app, auth, googleProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,    // ✅ Admin login ke liye
  createUserWithEmailAndPassword, // ✅ Signup ke liye
  sendEmailVerification,          // ✅ Email verify ke liye
  sendPasswordResetEmail,         // ✅ Password reset ke liye
  updatePassword,
  updateEmail,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged,
};
export type { User };

// ─── Types ────────────────────────────────────────────────────────────────────
export interface UserProfile {
  uid:           string;
  id?:           string;
  email:         string | null;
  displayName:   string | null;
  name?:         string;
  photoURL:      string | null;
  phone:         string | null | undefined;
  role:          "customer" | "staff" | "admin" | "super_admin";
  restaurantId?: string;
  totalOrders?:  number;
  totalSpent?:   number;
  createdAt?:    unknown;
  updatedAt?:    unknown;
}

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
  openingHours?: unknown;
  theme?:        string | { primaryColor?: string; secondaryColor?: string } | Record<string, unknown>;
  upiId?:        string;
  acceptCash?:   boolean;
  acceptCard?:   boolean;
  updatedAt?:    unknown;
  createdAt?:    unknown;
  [key: string]: unknown;
}

export interface Category {
  id:         string;
  name:       string;
  icon?:      string;
  order?:     number;
  sortOrder?: number;
  slug?:      string;
  isActive?:  boolean;
}

export interface Variant { name: string; price: number; }
export interface Addon   { name: string; price: number; }

export interface MenuItem {
  id:              string;
  categoryId:      string;
  name:            string;
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
  prepTime?:       number;
  calories?:       number;
  variants?:       string | Variant[];
  addons?:         string | Addon[];
  allergens?:      string | string[];
  ingredients?:    string | string[];
}

export interface Offer {
  id:            string;
  restaurantId?: string;
  title:         string;
  description?:  string;
  image?:        string;
  discountType:  string;
  discountValue: number;
  code?:         string;
  isActive?:     boolean;
  validFrom?:    unknown;
  validTo?:      unknown;
  createdAt?:    unknown;
}

export interface Coupon {
  id:             string;
  code:           string;
  description?:   string;
  discountType:   "percentage" | "flat";
  discountValue:  number;
  minOrder?:      number;
  minOrderValue?: number;
  maxDiscount?:   number;
  isActive?:      boolean;
  usageLimit?:    number;
  usageCount?:    number;
  usedCount?:     number;
  expiresAt?:     unknown;
  createdAt?:     unknown;
}

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
  status:         "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled" | "served" | "completed";
  paymentStatus?: string;
  paymentMode?:   string;
  isPaid?:        boolean;
  notes?:         string;
  couponCode?:    string;
  createdAt?:     unknown;
  updatedAt?:     unknown;
}