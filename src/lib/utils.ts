import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// 1. Shadcn ke components ke liye 'cn' function
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 2. Prices ko Rupee format mein dikhane ke liye 'formatCurrency' function
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

// 3. Order Number generate karne ka function
export function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  
  return `ORD-${year}${month}${day}-${randomStr}`;
}

// 4. CGST (Central GST - 2.5%) calculate karne ke liye
export function calculateCGST(subtotal: number): number {
  const taxRate = 0.025; // 2.5% CGST
  return Math.round(subtotal * taxRate);
}

// 5. SGST (State GST - 2.5%) calculate karne ke liye
export function calculateSGST(subtotal: number): number {
  const taxRate = 0.025; // 2.5% SGST
  return Math.round(subtotal * taxRate);
}

// 6. ✅ Naya Added: Text ko URL-friendly banana (Jaise: "Cold Drinks" -> "cold-drinks")
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")        // Spaces ko - se replace karein
    .replace(/[^\w\-]+/g, "")     // Special characters hatayein
    .replace(/\-\-+/g, "-");     // Multiple hyphens ko single hyphen karein
}

// --- Aapka Puraana Code Date ke liye ---

function toSafeDate(input: unknown): Date | null {
  if (!input) return null;

  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input;
  }

  if (typeof input === "string" || typeof input === "number") {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof input === "object" && input !== null) {
    const maybeTimestamp = input as { seconds?: number; _seconds?: number };

    if (typeof maybeTimestamp.seconds === "number") {
      const d = new Date(maybeTimestamp.seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    if (typeof maybeTimestamp._seconds === "number") {
      const d = new Date(maybeTimestamp._seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

export function formatDate(date: unknown): string {
  const d = toSafeDate(date);
  if (!d) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDateShort(date: unknown): string {
  const d = toSafeDate(date);
  if (!d) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(d);
}