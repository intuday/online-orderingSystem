// src/lib/firebase-admin.ts
// Firebase ADMIN SDK initialization — server-side only.
// All domain types live in @/lib/types — not here.

import { initializeApp, getApps, cert, type ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue }                           from "firebase-admin/firestore";
import { getAuth }                                            from "firebase-admin/auth";

// ── Private Key Parser ────────────────────────────────────────────────────────

function parsePrivateKey(raw: string | undefined): string {
  if (!raw) {
    throw new Error(
      "[Firebase Admin] FIREBASE_PRIVATE_KEY is missing from environment variables"
    );
  }

  let key = raw;

  // Remove surrounding quotes if present (common .env issue)
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Replace escaped newlines with real newlines
  key = key.replace(/\\n/g, "\n");

  if (!key.includes("-----BEGIN PRIVATE KEY-----")) {
    throw new Error(
      "[Firebase Admin] FIREBASE_PRIVATE_KEY is invalid. " +
      "Must start with '-----BEGIN PRIVATE KEY-----'"
    );
  }

  if (!key.includes("-----END PRIVATE KEY-----")) {
    throw new Error(
      "[Firebase Admin] FIREBASE_PRIVATE_KEY is invalid. " +
      "Must end with '-----END PRIVATE KEY-----'"
    );
  }

  return key;
}

// ── Environment Variable Validation ──────────────────────────────────────────

function validateEnvVars(): void {
  const missing: string[] = [];

  if (!process.env.FIREBASE_PROJECT_ID)   missing.push("FIREBASE_PROJECT_ID");
  if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push("FIREBASE_CLIENT_EMAIL");
  if (!process.env.FIREBASE_PRIVATE_KEY)  missing.push("FIREBASE_PRIVATE_KEY");

  if (missing.length > 0) {
    throw new Error(
      `[Firebase Admin] Missing required environment variables:\n${missing.join("\n")}`
    );
  }
}

// ── App Initialization ────────────────────────────────────────────────────────

function initializeAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  validateEnvVars();

  return initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }),
  });
}

const adminApp = initializeAdminApp();

export const db        = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
export const FieldVal  = FieldValue;

// ── Constraint Types ──────────────────────────────────────────────────────────

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

// ── Collection / Document Helpers ─────────────────────────────────────────────

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

// ── Read Helpers ──────────────────────────────────────────────────────────────

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

// ── Query Builder ─────────────────────────────────────────────────────────────

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

// ── Write Helpers ─────────────────────────────────────────────────────────────

export async function setDoc(
  ref:      FirebaseFirestore.DocumentReference,
  data:     Record<string, unknown>,
  options?: { merge?: boolean }
) {
  if (options?.merge) await ref.set(data, { merge: true });
  else await ref.set(data);
}

export async function addDoc(
  ref:  FirebaseFirestore.CollectionReference,
  data: Record<string, unknown>
) {
  return ref.add(data);
}

export async function updateDoc(
  ref:  FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
) {
  await ref.set(data, { merge: true });
}

export async function deleteDoc(ref: FirebaseFirestore.DocumentReference) {
  await ref.delete();
}

// ── FieldValue Helpers ────────────────────────────────────────────────────────

export const serverTimestamp = () => FieldValue.serverTimestamp();
export const increment       = (n: number) => FieldValue.increment(n);
export const arrayUnion      = (...items: unknown[]) => FieldValue.arrayUnion(...items);
export const arrayRemove     = (...items: unknown[]) => FieldValue.arrayRemove(...items);

// ── Type Exports ──────────────────────────────────────────────────────────────

export type { ServiceAccount };