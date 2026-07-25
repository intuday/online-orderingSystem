// src/lib/auth/server-auth.ts
//
// Centralized server-side auth utilities.
// Single source of truth for token verification and admin role checks.
// All API routes MUST import from here — do not duplicate verification logic.

import { NextRequest }              from "next/server";
import { adminAuth, db,
         doc, getDoc }              from "@/lib/firebase-admin";
import type { UserRole }            from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLES: readonly UserRole[] = ["admin", "super_admin"] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerifiedUser {
  uid:   string;
  email: string;
}

export interface VerifiedAdmin {
  uid:   string;
  email: string;
  role:  UserRole;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Reads and verifies the Firebase ID token from the auth-token cookie.
 * Returns the decoded user info or null if invalid/missing.
 *
 * Use this in any API route that needs to know WHO the caller is.
 */
export async function verifyAuthToken(
  request: NextRequest
): Promise<VerifiedUser | null> {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid:   decoded.uid,
      email: decoded.email ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Checks if a given uid has admin or super_admin role in Firestore.
 * Returns false if user doesn't exist or role is not admin.
 */
export async function isAdminUser(uid: string): Promise<boolean> {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return false;
    const role = userSnap.data()?.role as UserRole | undefined;
    return role !== undefined && ADMIN_ROLES.includes(role);
  } catch {
    return false;
  }
}

/**
 * Full admin verification — token + role check.
 * Returns admin details or null if not authorized.
 *
 * Use this in any admin API route (POST, PUT, DELETE) as the FIRST check.
 */
export async function verifyAdmin(
  request: NextRequest
): Promise<VerifiedAdmin | null> {
  const verified = await verifyAuthToken(request);
  if (!verified) return null;

  const userSnap = await getDoc(doc(db, "users", verified.uid));
  if (!userSnap.exists()) return null;

  const role = userSnap.data()?.role as UserRole | undefined;
  if (!role || !ADMIN_ROLES.includes(role)) return null;

  return {
    uid:   verified.uid,
    email: verified.email,
    role,
  };
}