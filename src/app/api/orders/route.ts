// src/app/api/orders/route.ts
import {
  db,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  limit,
  orderBy,
  adminAuth,
} from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateOrderNumber, calculateCGST, calculateSGST } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";
import { NextRequest } from "next/server";

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

async function verifyAuthToken(
  request: NextRequest
): Promise<{ uid: string; name: string; phone: string } | null> {
  const token = request.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid:   decoded.uid,
      name:  (decoded.name  as string) || "",
      phone: (decoded.phone as string) || "",
    };
  } catch {
    return null;
  }
}

async function isAdminUser(uid: string): Promise<boolean> {
  try {
    const userSnap = await getDoc(doc(db, "users", uid));
    if (!userSnap.exists()) return false;
    const role = userSnap.data()?.role as string;
    return role === "admin" || role === "super_admin";
  } catch {
    return false;
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

function normalizeItem(item: RawOrderItem) {
  const originalPrice = Math.max(0, Number(item.originalPrice ?? item.price ?? 0));
  const isPromo       = item.isPromotional === true;
  const promoPrice    = isPromo
    ? Math.max(0, Number(item.promoPrice ?? originalPrice))
    : null;
  const quantity      = Math.max(1, Math.round(Number(item.quantity ?? 1)));

  return {
    menuItemId:          String(item.menuItemId || ""),
    name:                String(item.name       || "Item"),
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

// ─── POST /api/orders ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tableId:         rawTableId,
      customerId,
      customerName,
      customerPhone,
      items            = [],
      notes,
      couponCode,
      couponDiscount   = 0,
      tip              = 0,
      restaurantId: bodyRestaurantId = RESTAURANT_ID,
    } = body;

    const verified = await verifyAuthToken(request);

    if (!verified) {
      return Response.json(
        { error: "login_required", message: "Please login to place an order" },
        { status: 401 }
      );
    }

    const loggedInUid   = verified.uid;
    const loggedInName  = verified.name;
    const loggedInPhone = verified.phone;

    if (!rawTableId) {
      return Response.json(
        {
          error:   "table_required",
          message: "Please scan your table QR code to place an order.",
        },
        { status: 400 }
      );
    }

    let finalTableId:      string | null          = null;
    let finalTableNumber:  string | number | null = null;
    let finalRestaurantId  = bodyRestaurantId;
    let sessionId:         string | null          = null;

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

    const finalCustomerId    = loggedInUid   || customerId   || null;
    const finalCustomerName  = loggedInName  || customerName  || "Guest";
    const finalCustomerPhone = loggedInPhone || customerPhone || "";

    // ── Strong table ownership / occupancy enforcement ──────────────────────

    if (finalTableId) {
      const tableSnap = await getDoc(doc(db, "tables", finalTableId));

      if (tableSnap.exists()) {
        const tableData   = (tableSnap.data() ?? {}) as TableStateData;
        const tableStatus = tableData.status || "available";

        const sameSession      = Boolean(sessionId && tableData.currentSessionId === sessionId);
        const sameReservedUser = Boolean(finalCustomerId && tableData.reservedByUid === finalCustomerId);
        const sameOccupiedUser = Boolean(finalCustomerId && tableData.occupiedByUid === finalCustomerId);

        // Reserved by someone else → block
        if (tableStatus === "reserved" && !sameSession && !sameReservedUser) {
          return Response.json(
            {
              error:   "table_in_use",
              message: "This table is currently in use by another guest.",
            },
            { status: 409 }
          );
        }

        // Occupied by someone else → block
        if (tableStatus === "occupied" && !sameSession && !sameOccupiedUser) {
          return Response.json(
            {
              error:   "table_occupied",
              message: "This table already has an active order.",
            },
            { status: 409 }
          );
        }
      }
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Response.json(
        { error: "invalid_items", message: "Order must contain at least one item" },
        { status: 400 }
      );
    }

    const normalizedItems = (items as RawOrderItem[]).map(normalizeItem);

    const grossSubtotal = normalizedItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity,
      0
    );

    const computedPromoDiscount = normalizedItems.reduce((sum, item) => {
      if (!item.isPromotional || item.promoPrice === null) return sum;
      return sum + (item.originalPrice - item.promoPrice) * item.quantity;
    }, 0);

    const safeCouponDiscount = Math.max(0, Number(couponDiscount || 0));
    const totalDiscount      = safeCouponDiscount + computedPromoDiscount;
    const taxableAmount      = Math.max(0, grossSubtotal - totalDiscount);
    const cgst               = calculateCGST(taxableAmount);
    const sgst               = calculateSGST(taxableAmount);
    const safeTip            = Math.max(0, Number(tip || 0));
    const total              = taxableAmount + cgst + sgst + safeTip;
    const orderNumber        = generateOrderNumber();

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
      couponDiscount:  safeCouponDiscount,
      promoDiscount:   computedPromoDiscount,
      tip:             safeTip,
      total,
      couponCode:      couponCode || null,
      notes:           notes      || "",
      status:          "pending"  as OrderStatus,
      paymentStatus:   "unpaid",
      paymentMode:     "cash",
      createdAt:       serverTimestamp(),
      updatedAt:       serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);

    await Promise.allSettled([
      finalCustomerId
        ? updateDoc(doc(db, "users", finalCustomerId), {
            totalOrders: FieldValue.increment(1),
            totalSpent:  FieldValue.increment(total),
          })
        : Promise.resolve(),

      sessionId
        ? updateDoc(doc(db, "sessions", sessionId), {
            ordersCount:  FieldValue.increment(1),
            totalSpent:   FieldValue.increment(total),
            lastActivity: serverTimestamp(),
            updatedAt:    serverTimestamp(),
          })
        : Promise.resolve(),

      finalTableId
        ? updateDoc(doc(db, "tables", finalTableId), {
            status:           "occupied",
            currentOrderId:   docRef.id,
            currentSessionId: sessionId,
            reservedByUid:    finalCustomerId,
            reservedBy:       finalCustomerName,
            occupiedByUid:    finalCustomerId,
            occupiedBy:       finalCustomerName,
            occupiedAt:       serverTimestamp(),
            updatedAt:        serverTimestamp(),
          })
        : Promise.resolve(),
    ]);

    return Response.json(
      {
        order: {
          id:        docRef.id,
          ...orderData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
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