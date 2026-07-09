import { db, collection, getDocs, query, where } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

export async function POST(request: Request) {
  try {
    const {
      code,
      subtotal = 0,
      restaurantId = RESTAURANT_ID,
    } = await request.json();

    if (!code) {
      return Response.json({ valid: false, error: "Coupon code required" });
    }

    if (subtotal <= 0) {
      return Response.json({ valid: false, error: "Cart is empty" });
    }

    const q = query(
      collection(db, "coupons"),
      where("restaurantId", "==", restaurantId),
      where("code", "==", code.toUpperCase()),
      where("isActive", "==", true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return Response.json({ valid: false, error: "Invalid or expired coupon" });
    }

    const couponDoc = snapshot.docs[0];
    const c = couponDoc.data() as any;

    // ✅ Min order check
    const minVal = Number(c.minOrderValue ?? c.minOrder ?? 0);
    if (minVal > 0 && subtotal < minVal) {
      return Response.json({
        valid: false,
        error: `Add ₹${Math.ceil(minVal - subtotal)} more to use this coupon (Min order: ₹${minVal})`,
      });
    }

    // ✅ Usage limit check
    const usedCount  = Number(c.usedCount  ?? c.usageCount ?? 0);
    const usageLimit = Number(c.usageLimit ?? 0);
    if (usageLimit > 0 && usedCount >= usageLimit) {
      return Response.json({ valid: false, error: "Coupon usage limit reached" });
    }

    // ✅ Expiry check
    if (c.validTo) {
      const expiry = (c.validTo as any)?._seconds
        ? new Date((c.validTo as any)._seconds * 1000)
        : new Date(c.validTo as string);
      if (expiry < new Date()) {
        return Response.json({ valid: false, error: "Coupon has expired" });
      }
    }

    // ✅ Calculate discount
    let discount = 0;
    if (c.discountType === "percentage") {
      discount = Math.round((subtotal * Number(c.discountValue)) / 100);
      // Max discount cap
      if (c.maxDiscount && discount > Number(c.maxDiscount)) {
        discount = Number(c.maxDiscount);
      }
    } else {
      discount = Number(c.discountValue);
    }

    // ✅ CRITICAL: Discount subtotal se zyada nahi ho sakta
    discount = Math.min(discount, Math.floor(subtotal));

    // ✅ Discount 0 ya negative nahi hona chahiye
    if (discount <= 0) {
      return Response.json({
        valid: false,
        error: "Coupon not applicable on this order amount",
      });
    }

    return Response.json({
      valid:    true,
      discount,
      savings:  discount,
      message:  `You save ₹${discount}!`,
      coupon:   {
        id:            couponDoc.id,
        code:          c.code,
        discountType:  c.discountType,
        discountValue: c.discountValue,
        minOrderValue: minVal,
        maxDiscount:   c.maxDiscount || null,
      },
    });
  } catch (error) {
    console.error("Coupon validate error:", error);
    return Response.json({ valid: false, error: "Failed to validate" }, { status: 500 });
  }
}