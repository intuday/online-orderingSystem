// src/lib/utils.ts

import { type ClassValue, clsx } from "clsx";
import { twMerge }               from "tailwind-merge";

// ─── Tailwind / Class Utilities ───────────────────────────────────────────────

/**
 * Merges Tailwind classes safely — used by shadcn/ui components.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Formats a number as Indian Rupees (₹).
 * Example: 1500 → "₹1,500"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style:                "currency",
    currency:             "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── GST Calculation ──────────────────────────────────────────────────────────

/**
 * India GST rate split: 2.5% CGST + 2.5% SGST = 5% total.
 * Both components are always equal — use this single constant.
 */
export const GST_COMPONENT_RATE = 0.025;

/**
 * Calculates CGST (Central GST) at 2.5% on the given subtotal.
 * Returns a whole number (rounded).
 */
export function calculateCGST(subtotal: number): number {
  return Math.round(subtotal * GST_COMPONENT_RATE);
}

/**
 * Calculates SGST (State GST) at 2.5% on the given subtotal.
 * Returns a whole number (rounded).
 */
export function calculateSGST(subtotal: number): number {
  return Math.round(subtotal * GST_COMPONENT_RATE);
}

/**
 * Calculates total GST (CGST + SGST = 5%) on the given subtotal.
 */
export function calculateTotalGST(subtotal: number): number {
  return calculateCGST(subtotal) + calculateSGST(subtotal);
}

// ─── Order Number ─────────────────────────────────────────────────────────────

/**
 * Generates a display-friendly order number.
 *
 * Format: ORD-YYYYMMDD-HHMMSS-XXXX
 */
export function generateOrderNumber(): string {
  const now    = new Date();
  const year   = now.getFullYear();
  const month  = String(now.getMonth() + 1).padStart(2, "0");
  const day    = String(now.getDate()).padStart(2, "0");
  const hour   = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `ORD-${year}${month}${day}-${hour}${minute}-${random}`;
}

// ─── Slug ─────────────────────────────────────────────────────────────────────

/**
 * Converts text to a URL-friendly slug.
 * Example: "Cold Drinks" → "cold-drinks"
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/-{2,}/g, "-");
}

// ─── Firestore Timestamp Helpers ──────────────────────────────────────────────
//
// SINGLE SOURCE OF TRUTH for Firestore timestamp extraction.
// All routes and components MUST import from here — do not duplicate.

/**
 * Safely converts any Firestore-like timestamp value to a JavaScript Date.
 *
 * Handles:
 * - JavaScript Date objects
 * - ISO strings and numeric timestamps
 * - Firestore Timestamp objects (with .toDate() method)
 * - Raw serialized Firestore timestamps ({ seconds, _seconds })
 *
 * Returns null if the value cannot be parsed.
 */
export function firestoreToDate(input: unknown): Date | null {
  if (!input) return null;

  // Native Date
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  // String or numeric timestamp
  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "object" && input !== null) {
    // Firestore Timestamp instance — use .toDate() if available
    if (typeof (input as { toDate?: unknown }).toDate === "function") {
      try {
        const d = (input as { toDate: () => Date }).toDate();
        return Number.isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }

    // Raw Firestore timestamp shape from API responses (already serialized)
    const maybeTs = input as { seconds?: number; _seconds?: number };

    if (typeof maybeTs.seconds === "number") {
      const d = new Date(maybeTs.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof maybeTs._seconds === "number") {
      const d = new Date(maybeTs._seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

/**
 * Extracts milliseconds from any Firestore-like timestamp value.
 * Returns 0 if the value cannot be parsed.
 *
 * Useful for sorting and comparisons.
 */
export function firestoreToMs(input: unknown): number {
  const d = firestoreToDate(input);
  return d ? d.getTime() : 0;
}

/**
 * @deprecated Use firestoreToDate instead. Kept for backward compatibility.
 */
function toSafeDate(input: unknown): Date | null {
  return firestoreToDate(input);
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Formats a date-like value as a full date + time string.
 * Example: "12 Jan 2025, 02:30 PM"
 * Returns "-" if the value cannot be parsed.
 */
export function formatDate(date: unknown): string {
  const d = toSafeDate(date);
  if (!d) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day:    "2-digit",
    month:  "short",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Formats a date-like value as a short date string (no time).
 * Example: "12 Jan"
 * Returns "-" if the value cannot be parsed.
 */
export function formatDateShort(date: unknown): string {
  const d = toSafeDate(date);
  if (!d) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day:   "2-digit",
    month: "short",
  }).format(d);
}