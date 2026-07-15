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
export const GST_COMPONENT_RATE = 0.025; // 2.5% each for CGST and SGST

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
 * Note: CGST and SGST are always equal — both delegate to the same rate constant.
 */
export function calculateSGST(subtotal: number): number {
  return Math.round(subtotal * GST_COMPONENT_RATE);
}

/**
 * Calculates total GST (CGST + SGST = 5%) on the given subtotal.
 * Convenience function to avoid calling both individually.
 */
export function calculateTotalGST(subtotal: number): number {
  return calculateCGST(subtotal) + calculateSGST(subtotal);
}

// ─── Order Number ─────────────────────────────────────────────────────────────

/**
 * Generates a display-friendly order number.
 *
 * Format: ORD-YYYYMMDD-HHMMSS-XXXX
 * - Date + time component reduces same-day collisions
 * - 6-char random suffix for additional uniqueness
 *
 * NOTE: This is for display only. The Firestore document ID
 * is the canonical unique identifier for an order.
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
    .replace(/\s+/g, "-")       // Spaces → hyphens
    .replace(/[^\w-]+/g, "")    // Remove special characters (hyphen at end = unambiguous)
    .replace(/-{2,}/g, "-");    // Collapse multiple hyphens
}

// ─── Date Formatting ──────────────────────────────────────────────────────────

/**
 * Safely converts any date-like value to a JavaScript Date.
 *
 * Handles:
 * - JavaScript Date objects
 * - ISO strings and numeric timestamps
 * - Firestore Timestamp objects (with .toDate() method)
 * - Raw Firestore timestamp shapes ({ seconds, _seconds })
 *
 * Returns null if the value cannot be parsed.
 */
function toSafeDate(input: unknown): Date | null {
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