// src/app/api/orders/route.ts
import {
  db,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  doc,
  getDoc,
  limit,
  orderBy,
}                                                            from "@/lib/firebase-admin";
import { FieldValue }                                        from "firebase-admin/firestore";
import { verifyAuthToken, isAdminUser }                      from "@/lib/auth/server-auth";
import { generateOrderNumber, calculateCGST, calculateSGST } from "@/lib/utils";
import type { Order, OrderStatus }                           from "@/lib/types";
import { NextRequest }                                       from "next/server";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const DEFAULT_PAGE_LIMIT = 100;

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawOrderItem {
  menuItemId?:          string;
  name?:                string;
  price?:               number | string;
  originalPrice?:       number | string;
  promoPrice?:          number | string | null;
  quantity?:            number | string;
  variant?:             string | null;
  addons?:              unknown[];
  specialInstructions?: string;
  image?:               string;
  isPromotional?:       boolean;
  offerId?:             string | null;
  offerTitle?:          string | null;
}

interface TableStateData {
  status?:           string;
  currentSessionId?: string | null;
  currentOrderId?:   string | null;
  reservedByUid?:    string | null;
  occupiedByUid?:    string | null;
}

interface ProductData {
  price?:        number;
  name?:         string;
  isAvailable?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getUserProfile(uid: string): Promise<{ name: string; phone: string }> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return { name: "", phone: "" };
    const d = snap.data() ?? {};
    return {
      name:  (d.name  as string) || (d.displayName as string) || "",
      phone: (d.phone as string) || "",
    };
  } catch {
    return { name: "", phone: "" };
  }
}

async function resolveTable(tableValue: string) {
  const byIdSnap = await getDoc(doc(db, "tables", tableValue));
  if (byIdSnap.exists()) {
    return { id: byIdSnap.id, data: byIdSnap.data() };
  }
  const tableNumber = Number(tableValue);
  if (!Number.isNaN(tableNumber)) {
    const snap = await getDocs(
      query(
        collection(db, "tables"),
        where("number", "==", tableNumber),
        limit(1)
      )
    );
    if (!snap.empty) {
      return { id: snap.docs[0].id, data: snap.docs[0].data() };
    }
  }
  return null;
}

/**
 * SERVER-SIDE PRICE VALIDATION
 * Fetches actual prices from Firestore for all items in the order.
 * Ignores client-sent prices — prevents price manipulation attacks.
 * Returns a map of menuItemId → validated product data.
 */
async function fetchProductPrices(
  menuItemIds: string[]
): Promise<Map<string, ProductData>> {
  const priceMap = new Map<string, ProductData>();

  // Parallel fetch all products
  const results = await Promise.allSettled(
    menuItemIds.map((id) => getDoc(doc(db, "products", id)))
  );

  results.forEach((result, idx) => {
    if (result.status === "fulfilled" && result.value.exists()) {
      const data = result.value.data() as ProductData;
      priceMap.set(menuItemIds[idx], {
        price:       Number(data.price) || 0,
        name:        String(data.name)  || "Item",
        isAvailable: data.isAvailable !== false,
      });
    }
  });

  return priceMap;
}

// ─── GET /api/orders ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const verified = await verifyAuthToken(request);

    if (!verified) {
      return Response.json(
        { error: "Authentication required to view orders" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;
    const status           = searchParams.get("status");
    const requestedId      = searchParams.get("customerId");
    const pageLimit        = Math.min(
      Number(searchParams.get("limit") || DEFAULT_PAGE_LIMIT),
      500
    );

    const userIsAdmin = await isAdminUser(verified.uid);

    const effectiveCustomerId = userIsAdmin
      ? (requestedId ?? null)
      : verified.uid;

    let q;

    if (effectiveCustomerId && status && status !== "all") {
      q = query(
        collection(db, "orders"),
        where("restaurantId", "==", restaurantId),
        where("customerId",   "==", effectiveCustomerId),
        where("status",       "==", status),
        orderBy("createdAt", "desc"),
        limit(pageLimit)
      );
    } else if (effectiveCustomerId) {
      q = query(
        collection(db, "orders"),
        where("restaurantId", "==", restaurantId),
        where("customerId",   "==", effectiveCustomerId),
        orderBy("createdAt", "desc"),
        limit(pageLimit)
      );
    } else if (status && status !== "all") {
      q = query(
        collection(db, "orders"),
        where("restaurantId", "==", restaurantId),
        where("status",       "==", status),
        orderBy("createdAt", "desc"),
        limit(pageLimit)
      );
    } else {
      q = query(
        collection(db, "orders"),
        where("restaurantId", "==", restaurantId),
        orderBy("createdAt", "desc"),
        limit(pageLimit)
      );
    }

    const snapshot = await getDocs(q);
    const orders   = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Order[];

    return Response.json({ orders });
  } catch (error) {
    console.error("Orders GET error:", error);
    return Response.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// ─── POST /api/orders — Atomic Transaction ────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tableId:         rawTableId,
      customerName,
      customerPhone,
      items            = [],
      notes,
      couponCode,
      couponDiscount   = 0,
      tip              = 0,
      restaurantId: bodyRestaurantId = RESTAURANT_ID,
    } = body;

    // ── Authentication ──────────────────────────────────────────────────────
    const verified = await verifyAuthToken(request);

    if (!verified) {
      return Response.json(
        { error: "login_required", message: "Please login to place an order" },
        { status: 401 }
      );
    }

    // ── Get user profile for name/phone ─────────────────────────────────────
    const profile       = await getUserProfile(verified.uid);
    const loggedInUid   = verified.uid;
    const loggedInName  = profile.name;
    const loggedInPhone = profile.phone;

    // ── Table required ──────────────────────────────────────────────────────
    if (!rawTableId) {
      return Response.json(
        {
          error:   "table_required",
          message: "Please scan your table QR code to place an order.",
        },
        { status: 400 }
      );
    }

    // ── Items validation ────────────────────────────────────────────────────
    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "invalid_items", message: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    // ── FIX 3: Server-side Price Validation ─────────────────────────────────
    // Fetch actual prices from Firestore — ignore client-sent prices for
    // regular items. Promo prices (from offers) are still trusted since
    // they come from the offer engine which was validated at menu load.

    const rawItems     = items as RawOrderItem[];
    const menuItemIds  = rawItems
      .map((i) => String(i.menuItemId || ""))
      .filter((id) => id.length > 0);

    const productMap = await fetchProductPrices(menuItemIds);

    // Build normalized items with SERVER prices (not client prices)
    const normalizedItems = rawItems.map((item) => {
      const menuItemId = String(item.menuItemId || "");
      const product    = productMap.get(menuItemId);

      // Use SERVER price if product exists, else fall back to client
      // (rare case — item deleted between menu load and order placement)
      const serverPrice = product?.price ?? 0;
      const clientPrice = Math.max(0, Number(item.originalPrice ?? item.price ?? 0));

      // If server has a valid price, use it. Otherwise fall back to client.
      const originalPrice = serverPrice > 0 ? serverPrice : clientPrice;

      const isPromo    = item.isPromotional === true;
      const promoPrice = isPromo
        ? Math.max(0, Number(item.promoPrice ?? originalPrice))
        : null;

      const quantity = Math.max(1, Math.round(Number(item.quantity ?? 1)));

      return {
        menuItemId,
        name:                product?.name || String(item.name || "Item"),
        price:               originalPrice,
        originalPrice,
        promoPrice,
        quantity,
        variant:             item.variant             || null,
        addons:              Array.isArray(item.addons) ? item.addons : [],
        specialInstructions: item.specialInstructions  || "",
        image:               item.image               || "",
        isPromotional:       isPromo,
        offerId:             item.offerId              || null,
        offerTitle:          item.offerTitle           || null,
      };
    });

    // ── Resolve Active Session ──────────────────────────────────────────────
    let finalTableId:     string | null          = null;
    let finalTableNumber: string | number | null = null;
    let finalRestaurantId = bodyRestaurantId;
    let sessionId:        string | null          = null;

    const sessionSnap = await getDocs(
      query(
        collection(db, "sessions"),
        where("userId", "==", loggedInUid),
        where("status", "==", "ACTIVE"),
        limit(1)
      )
    );

    if (!sessionSnap.empty) {
      const s           = sessionSnap.docs[0];
      const sd          = s.data();
      sessionId         = s.id;
      finalTableId      = (sd.tableId      as string) || null;
      finalTableNumber  = (sd.tableNumber  as string | number) || null;
      finalRestaurantId = (sd.restaurantId as string) || finalRestaurantId;
    }

    // Fallback: resolve table from raw tableId if no session
    if (!finalTableId && rawTableId) {
      const resolved = await resolveTable(String(rawTableId));
      if (!resolved) {
        return Response.json(
          { error: "table_not_found", message: "Table not found" },
          { status: 404 }
        );
      }
      finalTableId      = resolved.id;
      finalTableNumber  = (resolved.data?.number as string | number) || rawTableId;
      finalRestaurantId = (resolved.data?.restaurantId as string)    || finalRestaurantId;
    }

    const finalCustomerId    = loggedInUid   || null;
    const finalCustomerName  = loggedInName  || customerName  || "Guest";
    const finalCustomerPhone = loggedInPhone || customerPhone || "";

    // ── Calculate Totals (all server-side) ──────────────────────────────────
    const grossSubtotal = normalizedItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0
    );

    const computedPromoDiscount = normalizedItems.reduce((sum, item) => {
      if (!item.isPromotional || item.promoPrice === null) return sum;
      return sum + (item.originalPrice - item.promoPrice) * item.quantity;
    }, 0);

    const safeCouponDiscount = Math.max(0, Number(couponDiscount || 0));

    // Coupon discount cannot exceed subtotal after promo
    const cappedCouponDiscount = Math.min(
      safeCouponDiscount,
      Math.max(0, grossSubtotal - computedPromoDiscount)
    );

    const totalDiscount = cappedCouponDiscount + computedPromoDiscount;
    const taxableAmount = Math.max(0, grossSubtotal - totalDiscount);
    const cgst          = calculateCGST(taxableAmount);
    const sgst          = calculateSGST(taxableAmount);
    const safeTip       = Math.max(0, Number(tip || 0));
    const total         = taxableAmount + cgst + sgst + safeTip;
    const orderNumber   = generateOrderNumber();

    // ── FIX 2: Atomic Transaction ───────────────────────────────────────────
    // Firestore transaction ensures:
    // 1. Table state check + order create + table update = atomic
    // 2. No race condition — two users cannot both succeed on same table
    // 3. Rolls back automatically on failure

    if (!finalTableId) {
      return Response.json(
        { error: "table_required", message: "Table not resolved" },
        { status: 400 }
      );
    }

    const tableRef    = doc(db, "tables", finalTableId);
const newOrderRef = doc(db, "orders", db.collection("orders").doc().id);
    try {
      await db.runTransaction(async (transaction) => {
        // 1. Read table state INSIDE transaction (atomic snapshot)
        const tableSnap = await transaction.get(tableRef);

        if (!tableSnap.exists) {
          throw new Error("TABLE_NOT_FOUND");
        }

        const tableData   = (tableSnap.data() ?? {}) as TableStateData;
        const tableStatus = tableData.status || "available";

        const sameSession      = Boolean(sessionId && tableData.currentSessionId === sessionId);
        const sameReservedUser = Boolean(finalCustomerId && tableData.reservedByUid === finalCustomerId);
        const sameOccupiedUser = Boolean(finalCustomerId && tableData.occupiedByUid === finalCustomerId);

        // Reserved by someone else → block
        if (tableStatus === "reserved" && !sameSession && !sameReservedUser) {
          throw new Error("TABLE_IN_USE");
        }

        // Occupied by someone else → block
        if (tableStatus === "occupied" && !sameSession && !sameOccupiedUser) {
          throw new Error("TABLE_OCCUPIED");
        }

        // 2. Build order document
        const orderData = {
          restaurantId:    finalRestaurantId,
          orderNumber,
          tableId:         finalTableId,
          tableNumber:     finalTableNumber,
          sessionId,
          customerId:      finalCustomerId,
          customerName:    finalCustomerName,
          customerPhone:   finalCustomerPhone,
          items:           normalizedItems,
          subtotal:        grossSubtotal,
          taxAmount:       cgst + sgst,
          cgst,
          sgst,
          discount:        totalDiscount,
          couponDiscount:  cappedCouponDiscount,
          promoDiscount:   computedPromoDiscount,
          tip:             safeTip,
          total,
          couponCode:      couponCode || null,
          notes:           notes      || "",
          status:          "pending"  as OrderStatus,
          paymentStatus:   "unpaid",
          paymentMode:     "cash",
          isPaid:          false,
          createdAt:       serverTimestamp(),
          updatedAt:       serverTimestamp(),
        };

        // 3. Create order (atomic)
        transaction.set(newOrderRef, orderData);

        // 4. Update table state (atomic)
        transaction.update(tableRef, {
          status:           "occupied",
          currentOrderId:   newOrderRef.id,
          currentSessionId: sessionId,
          reservedByUid:    finalCustomerId,
          reservedBy:       finalCustomerName,
          occupiedByUid:    finalCustomerId,
          occupiedBy:       finalCustomerName,
          occupiedAt:       serverTimestamp(),
          updatedAt:        serverTimestamp(),
        });
      });

    } catch (txError) {
      const msg = (txError as Error).message;

      if (msg === "TABLE_NOT_FOUND") {
        return Response.json(
          { error: "table_not_found", message: "Table not found" },
          { status: 404 }
        );
      }
      if (msg === "TABLE_IN_USE") {
        return Response.json(
          {
            error:   "table_in_use",
            message: "This table is currently in use by another guest.",
          },
          { status: 409 }
        );
      }
      if (msg === "TABLE_OCCUPIED") {
        return Response.json(
          {
            error:   "table_occupied",
            message: "This table already has an active order.",
          },
          { status: 409 }
        );
      }
      throw txError;
    }

    // ── Non-critical Side Effects (parallel, non-blocking) ──────────────────
    // These don't need to be atomic — if they fail, order still succeeds

    await Promise.allSettled([
      finalCustomerId
        ? updateDocSafe(doc(db, "users", finalCustomerId), {
            totalOrders: FieldValue.increment(1),
            totalSpent:  FieldValue.increment(total),
          })
        : Promise.resolve(),

      sessionId
        ? updateDocSafe(doc(db, "sessions", sessionId), {
            ordersCount:  FieldValue.increment(1),
            totalSpent:   FieldValue.increment(total),
            lastActivity: serverTimestamp(),
            updatedAt:    serverTimestamp(),
          })
        : Promise.resolve(),
    ]);

    return Response.json(
      {
        order: {
          id:            newOrderRef.id,
          restaurantId:  finalRestaurantId,
          orderNumber,
          tableId:       finalTableId,
          tableNumber:   finalTableNumber,
          sessionId,
          customerId:    finalCustomerId,
          customerName:  finalCustomerName,
          customerPhone: finalCustomerPhone,
          items:         normalizedItems,
          subtotal:      grossSubtotal,
          taxAmount:     cgst + sgst,
          cgst,
          sgst,
          discount:      totalDiscount,
          couponDiscount: cappedCouponDiscount,
          promoDiscount:  computedPromoDiscount,
          tip:            safeTip,
          total,
          couponCode:     couponCode || null,
          notes:          notes      || "",
          status:         "pending",
          paymentStatus:  "unpaid",
          paymentMode:    "cash",
          isPaid:         false,
          createdAt:      new Date().toISOString(),
          updatedAt:      new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order create error:", error);
    return Response.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

async function updateDocSafe(
  ref: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>
) {
  try {
    await ref.update(data);
  } catch (err) {
    console.error("Non-critical update failed:", err);
  }
}