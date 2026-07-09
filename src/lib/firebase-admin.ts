// src/lib/firebase-admin.ts
import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  throw new Error("Missing Firebase Admin credentials in .env.local");
}

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({ projectId, clientEmail, privateKey } as ServiceAccount),
      });

export const db        = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const FieldVal  = FieldValue;

// ── Constraint types ──────────────────────────────────────────────────────────
type WhereConstraint = {
  __type: "where";
  field:  string;
  op:     FirebaseFirestore.WhereFilterOp;
  value:  unknown;
};

type OrderByConstraint = {
  __type:     "orderBy";
  field:      string;
  direction?: "asc" | "desc";
};

type LimitConstraint = {
  __type: "limit";
  count:  number;
};

type QueryConstraint = WhereConstraint | OrderByConstraint | LimitConstraint;

// ── Collection / Doc helpers ──────────────────────────────────────────────────
export function collection(
  database: FirebaseFirestore.Firestore,
  ...pathSegments: string[]
) {
  return database.collection(pathSegments.join("/"));
}

export function doc(
  database: FirebaseFirestore.Firestore,
  ...pathSegments: string[]
) {
  return database.doc(pathSegments.join("/"));
}

// ── Read helpers ──────────────────────────────────────────────────────────────
export async function getDocs(
  ref: FirebaseFirestore.CollectionReference | FirebaseFirestore.Query
) {
  const snap = await ref.get();
  return {
    docs:  snap.docs,
    empty: snap.empty,
    size:  snap.size,
  };
}

export async function getDoc(ref: FirebaseFirestore.DocumentReference) {
  const snap = await ref.get();
  return {
    exists: () => snap.exists,
    id:     snap.id,
    data:   () => snap.data(),
    ref:    snap.ref,
  };
}

// ── Query builder helpers ─────────────────────────────────────────────────────
export function where(
  field: string,
  op:    FirebaseFirestore.WhereFilterOp,
  value: unknown
): WhereConstraint {
  return { __type: "where", field, op, value };
}

export function orderBy(
  field:      string,
  direction?: "asc" | "desc"
): OrderByConstraint {
  return { __type: "orderBy", field, direction };
}

export function limit(count: number): LimitConstraint {
  return { __type: "limit", count };
}

export function query(
  ref: FirebaseFirestore.CollectionReference,
  ...constraints: QueryConstraint[]
): FirebaseFirestore.Query {
  let q: FirebaseFirestore.Query = ref;

  for (const c of constraints) {
    if (c.__type === "where") {
      q = q.where(c.field, c.op, c.value);
    } else if (c.__type === "orderBy") {
      q = c.direction
        ? q.orderBy(c.field, c.direction)
        : q.orderBy(c.field);
    } else if (c.__type === "limit") {
      q = q.limit(c.count);
    }
  }

  return q;
}

// ── Write helpers ─────────────────────────────────────────────────────────────
export async function setDoc(
  ref:      FirebaseFirestore.DocumentReference,
  data:     Record<string, unknown>,
  options?: { merge?: boolean }
) {
  if (options?.merge) await ref.set(data, { merge: true });
  else await ref.set(data);
}

// ✅ Returns actual DocumentReference so updateDoc works after addDoc
export async function addDoc(
  ref:  FirebaseFirestore.CollectionReference,
  data: Record<string, unknown>
) {
  const docRef = await ref.add(data);
  return docRef;
}

// ✅ Uses .set() with merge - .update() was failing
export async function updateDoc(
  ref:  FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
) {
  await ref.set(data, { merge: true });
}

export async function deleteDoc(ref: FirebaseFirestore.DocumentReference) {
  await ref.delete();
}

// ── FieldValue helpers ────────────────────────────────────────────────────────
export const serverTimestamp = () => FieldValue.serverTimestamp();
export const increment       = (n: number) => FieldValue.increment(n);
export const arrayUnion      = (...items: unknown[]) => FieldValue.arrayUnion(...items);
export const arrayRemove     = (...items: unknown[]) => FieldValue.arrayRemove(...items);

// ── Type exports ──────────────────────────────────────────────────────────────
export type { ServiceAccount };
// ── Shared Types (firebase-admin routes ke liye) ──────────────────────────────
export interface Coupon {
  id:            string;
  code:          string;
  discountType:  "percentage" | "flat";
  discountValue: number;
  minOrder?:     number;
  maxDiscount?:  number;
  isActive?:     boolean;
  usageLimit?:   number;
  usageCount?:   number;
  expiresAt?:    unknown;
  createdAt?:    unknown;
}

export interface Restaurant {
  id:           string;
  name:         string;
  logo?:        string;
  description?: string;
  address?:     string;
  phone?:       string;
  email?:       string;
  currency?:    string;
  taxRate?:     number;
  isOpen?:      boolean;
}

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
  orderCount?:     number;
  prepTime?:       number;
  calories?:       number;
  sortOrder?:      number;
  variants?:       unknown[];
  addons?:         unknown[];
  allergens?:      unknown[];
  ingredients?:    unknown[];
  restaurantId?:   string;
  slug?:           string;
  createdAt?:      unknown;
  updatedAt?:      unknown;
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

export interface Offer {
  id:            string;
  restaurantId?: string;
  title:         string;
  description?:  string;
  image?:        string;
  discountType:  string;
  discountValue: number;
  isActive?:     boolean;
  validFrom?:    unknown;
  validTo?:      unknown;
  createdAt?:    unknown;
}
export interface Coupon {
  id:             string;
  code:           string;
  description?:   string;       // ✅ Added
  discountType:   "percentage" | "flat";
  discountValue:  number;
  minOrder?:      number;
  minOrderValue?: number;       // ✅ Added
  maxDiscount?:   number;
  isActive?:      boolean;
  usageLimit?:    number;
  usageCount?:    number;
  usedCount?:     number;       // ✅ Added
  expiresAt?:     unknown;
  createdAt?:     unknown;
}

export interface Restaurant {
  id:           string;
  name:         string;
  logo?:        string;
  description?: string;
  address?:     string;
  phone?:       string;
  email?:       string;
  currency?:    string;
  taxRate?:     number;
  gstRate?:     number;
  gstNumber?:   string;
  paymentMode?: string;         // ✅ Added
  isOpen?:      boolean;
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
  openingHours?: Record<string, unknown> | string | unknown;
  theme?:        string | Record<string, unknown>;
  upiId?:        string;
  acceptCash?:   boolean;
  acceptCard?:   boolean;
  updatedAt?:    unknown;
  createdAt?:    unknown;
  [key: string]: unknown; // ✅ Any future field allow karega
}
