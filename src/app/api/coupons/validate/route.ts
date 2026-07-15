// src/app/api/coupons/validate/route.ts
import { db, collection, getDocs, query, where } from "@/lib/firebase-admin";
import type { Coupon }                            from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawCoupon extends Partial<Coupon> {
  minOrder?:   number;   // legacy field — fallback for minOrderValue
  usedCount?:  number;   // legacy field — fallback for usageCount
  validTo?:    unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractExpiryDate(validTo: unknown): Date | null {
  if (!validTo) return null;
  if (typeof validTo === "string") return new Date(validTo);
  if (typeof validTo === "object" && validTo !== null) {
    const v = validTo as Record<string, unknown>;
    if (typeof v._seconds === "number") return new Date(v._seconds * 1000);
    if (typeof v.seconds  === "number") return new Date(v.seconds  * 1000);
    if (typeof (validTo as { toDate?: () => Date }).toDate === "function") {
      return (validTo as { toDate: () => Date }).toDate();
    }
  }
  return null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;

    const code         = typeof body.code         === "string" ? body.code.trim().toUpperCase() : "";
    const subtotal     = typeof body.subtotal     === "number" ? body.subtotal     : 0;
    const restaurantId = typeof body.restaurantId === "string" ? body.restaurantId : RESTAURANT_ID;

    // ── Input Validation ────────────────────────────────────────────────────

    if (!code) {
      return Response.json({ valid: false, error: "Coupon code is required" });
    }

    if (subtotal <= 0) {
      return Response.json({ valid: false, error: "Cart is empty" });
    }

    // ── Fetch Coupon ────────────────────────────────────────────────────────

    const snapshot = await getDocs(
      query(
        collection(db, "coupons"),
        where("restaurantId", "==", restaurantId),
        where("code",         "==", code),
        where("isActive",     "==", true)
      )
    );

    if (snapshot.empty) {
      return Response.json({ valid: false, error: "Invalid or expired coupon" });
    }

    const couponDoc = snapshot.docs[0];
    const c         = couponDoc.data() as RawCoupon;

    // ── Minimum Order Check ─────────────────────────────────────────────────

    // Support both canonical (minOrderValue) and legacy (minOrder) field names
    const minOrderValue = Number(c.minOrderValue ?? c.minOrder ?? 0);
    if (minOrderValue > 0 && subtotal < minOrderValue) {
      const needed = Math.ceil(minOrderValue - subtotal);
      return Response.json({
        valid: false,
        error: `Add ₹${needed} more to use this coupon (Min order: ₹${minOrderValue})`,
      });
    }

    // ── Usage Limit Check ───────────────────────────────────────────────────

    // Support both canonical (usageCount) and legacy (usedCount) field names
    const usageCount = Number(c.usageCount ?? c.usedCount ?? 0);
    const usageLimit = Number(c.usageLimit ?? 0);
    if (usageLimit > 0 && usageCount >= usageLimit) {
      return Response.json({ valid: false, error: "Coupon usage limit reached" });
    }

    // ── Expiry Check ────────────────────────────────────────────────────────

    if (c.validTo) {
      const expiry = extractExpiryDate(c.validTo);
      if (expiry && expiry < new Date()) {
        return Response.json({ valid: false, error: "Coupon has expired" });
      }
    }

    // ── Calculate Discount ──────────────────────────────────────────────────

    const discountValue = Number(c.discountValue ?? 0);
    let discount        = 0;

    if (c.discountType === "percentage") {
      discount = Math.round((subtotal * discountValue) / 100);
      // Cap at maxDiscount if set
      if (c.maxDiscount && discount > Number(c.maxDiscount)) {
        discount = Number(c.maxDiscount);
      }
    } else {
      // Flat discount
      discount = discountValue;
    }

    // Discount cannot exceed subtotal
    discount = Math.min(discount, Math.floor(subtotal));

    if (discount <= 0) {
      return Response.json({
        valid: false,
        error: "Coupon not applicable on this order amount",
      });
    }

    // ── Success ─────────────────────────────────────────────────────────────

    return Response.json({
      valid:    true,
      discount,
      savings:  discount,
      message:  `You save ₹${discount}!`,
      coupon: {
        id:            couponDoc.id,
        code:          c.code,
        discountType:  c.discountType,
        discountValue: c.discountValue,
        minOrderValue,
        maxDiscount:   c.maxDiscount ?? null,
      },
    });

  } catch (error) {
    console.error("Coupon validate error:", error);
    return Response.json(
      { valid: false, error: "Failed to validate coupon" },
      { status: 500 }
    );
  }
}