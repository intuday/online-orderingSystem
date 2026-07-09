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
} from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generateOrderNumber, calculateCGST, calculateSGST } from "@/lib/utils";
import { verify } from "jsonwebtoken";
import type { Order } from "@/lib/firebase";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

const JWT_SECRET =
  process.env.JWT_SECRET || "restaurant-saas-super-secret-jwt-key-2024";

async function resolveTableByIdOrNumber(tableValue: string) {
  const byIdRef = doc(db, "tables", tableValue);
  const byIdSnap = await getDoc(byIdRef);
  if (byIdSnap.exists()) {
    return { id: byIdSnap.id, data: byIdSnap.data() };
  }
  const tableNumber = Number(tableValue);
  if (!Number.isNaN(tableNumber)) {
    const q = query(collection(db, "tables"), where("number", "==", tableNumber));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return { id: snap.docs[0].id, data: snap.docs[0].data() };
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    const q = query(collection(db, "orders"), where("restaurantId", "==", restaurantId));
    const snapshot = await getDocs(q);
    let orders = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Order[];

    if (status && status !== "all") {
      orders = orders.filter((o) => o.status === status);
    }
    if (customerId) {
      orders = orders.filter((o) => o.customerId === customerId);
    }

    orders.sort((a, b) => {
      const aT = (a.createdAt as any)?._seconds ?? (a.createdAt as any)?.seconds ?? 0;
      const bT = (b.createdAt as any)?._seconds ?? (b.createdAt as any)?.seconds ?? 0;
      return bT - aT;
    });

    return Response.json({ orders });
  } catch (error) {
    console.error("Orders GET error:", error);
    return Response.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      tableId: rawTableId,
      customerId,
      customerName,
      customerPhone,
      items = [],
      notes,
      couponCode,
      couponDiscount = 0,
      tip = 0,
      restaurantId: bodyRestaurantId = RESTAURANT_ID,
    } = body;

    // -- auth --------------------------------------------------
    const authToken = request.cookies.get("auth-token")?.value;
    let loggedInUid   = "";
    let loggedInName  = "";
    let loggedInPhone = "";

    if (authToken) {
      try {
        const decoded = verify(authToken, JWT_SECRET) as any;
        loggedInUid   = decoded.uid   || "";
        loggedInName  = decoded.name  || "";
        loggedInPhone = decoded.phone || "";
      } catch {}
    }

    const isAdminOrder = body.isAdminOrder === true;
    if (!authToken && !isAdminOrder) {
      return Response.json(
        { error: "login_required", message: "Please login to place an order" },
        { status: 401 }
      );
    }

    // -- session + table resolve -------------------------------
    let finalTableId:     string | null       = null;
    let finalTableNumber: string | number | null = null;
    let finalRestaurantId = bodyRestaurantId;
    let sessionId: string | null = null;

    if (loggedInUid) {
      const sessionQ = query(
        collection(db, "sessions"),
        where("userId",  "==", loggedInUid),
        where("status",  "==", "ACTIVE")
      );
      const sessionSnap = await getDocs(sessionQ);
      if (!sessionSnap.empty) {
        const s  = sessionSnap.docs[0];
        const sd = s.data() as any;
        sessionId        = s.id;
        finalTableId     = sd.tableId     || null;
        finalTableNumber = sd.tableNumber || null;
        finalRestaurantId = sd.restaurantId || finalRestaurantId;
      }
    }

    if (!finalTableId && rawTableId) {
      const resolved = await resolveTableByIdOrNumber(rawTableId);
      if (!resolved) {
        return Response.json(
          { error: "table_not_found", message: "Table not found" },
          { status: 404 }
        );
      }
      finalTableId     = resolved.id;
      const td         = resolved.data || {};
      finalTableNumber = (td as any).number || rawTableId;
      finalRestaurantId = (td as any).restaurantId || finalRestaurantId;
    }

    // -- resolve customer info FIRST ---------------------------
    const finalCustomerId   = customerId   || loggedInUid  || null;
    const finalCustomerName = customerName || loggedInName || "Guest";
    const finalCustomerPhone = customerPhone || loggedInPhone || "";

    // -- table occupancy check (after customer info is ready) --
    if (finalTableId) {
      const tableRef  = doc(db, "tables", finalTableId);
      const tableSnap = await getDoc(tableRef);

      if (tableSnap.exists()) {
        const tableData  = tableSnap.data() as any;
        const tableStatus = tableData.status || "available";

        if (tableStatus === "occupied") {
          // ? Allow same session OR same user to order again
          const isSameSession = sessionId && tableData.currentSessionId === sessionId;
          const isSameUser    = finalCustomerId && tableData.currentOrderId && tableData.occupiedBy === finalCustomerName;

          if (!isSameSession && !isSameUser) {
            return Response.json(
              {
                error:   "table_occupied",
                message: "This table is currently occupied by another guest.",
              },
              { status: 409 }
            );
          }
          // same user/session ? allow multiple orders from same table ?
        }

        if (
          tableStatus === "reserved" &&
          sessionId &&
          tableData.currentSessionId &&
          tableData.currentSessionId !== sessionId
        ) {
          return Response.json(
            {
              error:   "table_reserved",
              message: "This table is already reserved by another guest.",
            },
            { status: 409 }
          );
        }
      }
    }

    // -- normalize items ---------------------------------------
    const normalizedItems = (items as any[]).map((item) => {
      const originalPrice = Number(item.originalPrice ?? item.price ?? 0);
      const isPromo       = item.isPromotional === true;
      const promoPrice    = isPromo ? Number(item.promoPrice ?? originalPrice) : null;

      return {
        menuItemId:          item.menuItemId,
        name:                item.name || "Item",
        price:               originalPrice,
        originalPrice,
        promoPrice,
        quantity:            Number(item.quantity || 1),
        variant:             item.variant    || null,
        addons:              item.addons     || [],
        specialInstructions: item.specialInstructions || "",
        image:               item.image      || "",
        isPromotional:       isPromo,
        offerId:             item.offerId    || null,
        offerTitle:          item.offerTitle || null,
      };
    });

    // -- calculate totals --------------------------------------
    const grossSubtotal = normalizedItems.reduce(
      (sum, item) => sum + item.originalPrice * item.quantity, 0
    );

    const computedPromoDiscount = normalizedItems.reduce((sum, item) => {
      if (!item.isPromotional || item.promoPrice === null) return sum;
      return sum + (item.originalPrice - item.promoPrice) * item.quantity;
    }, 0);

    const safeCouponDiscount = Number(couponDiscount || 0);
    const totalDiscount  = safeCouponDiscount + computedPromoDiscount;
    const taxableAmount  = Math.max(0, grossSubtotal - totalDiscount);
    const cgst           = calculateCGST(taxableAmount);
    const sgst           = calculateSGST(taxableAmount);
    const total          = taxableAmount + cgst + sgst + Number(tip || 0);
    const orderNumber    = generateOrderNumber();

    // -- build order data --------------------------------------
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
      tip:             Number(tip || 0),
      total,
      couponCode:      couponCode || null,
      notes:           notes || "",
      status:          "pending",
      paymentStatus:   "unpaid",
      paymentMode:     "counter",
      createdAt:       serverTimestamp(),
      updatedAt:       serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);

    // -- side effects ------------------------------------------
    if (finalCustomerId) {
      await updateDoc(doc(db, "users", finalCustomerId), {
        totalOrders: FieldValue.increment(1),
        totalSpent:  FieldValue.increment(Number(total)),
      }).catch(() => {});
    }

    if (sessionId) {
      await updateDoc(doc(db, "sessions", sessionId), {
        ordersCount:  FieldValue.increment(1),
        totalSpent:   FieldValue.increment(Number(total)),
        lastActivity: serverTimestamp(),
      }).catch(() => {});
    }

    // Keep table marked as occupied (same user ordering again)
    if (finalTableId) {
      await updateDoc(doc(db, "tables", finalTableId), {
        status:           "occupied",
        currentOrderId:   docRef.id,
        currentSessionId: sessionId,
        occupiedBy:       finalCustomerName,
        occupiedAt:       serverTimestamp(),
      }).catch(() => {});
    }

    return Response.json(
      {
        order: {
          id: docRef.id,
          ...orderData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Order create error:", error);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }
}
