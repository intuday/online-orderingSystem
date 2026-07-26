// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse }                    from "next/server";
import {
  db, doc, getDoc, updateDoc, serverTimestamp,
}                                                       from "@/lib/firebase-admin";
import { verifyAuthToken }                              from "@/lib/auth/server-auth";
import type { OrderStatus, PaymentStatus, PaymentMode } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES: OrderStatus[] = ["completed", "cancelled"];

const VALID_STATUSES: OrderStatus[] = [
  "pending", "confirmed", "preparing",
  "ready", "served", "delivered", "completed", "cancelled",
];

const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  "unpaid", "paid", "refunded", "failed",
];

const VALID_PAYMENT_MODES: PaymentMode[] = [
  "cash", "card", "upi", "online",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExistingOrderData {
  tableId?:      string;
  sessionId?:    string;
  status?:       OrderStatus;
  paymentStatus?: PaymentStatus;
  [key: string]: unknown;
}

// ─── GET /api/orders/[id] ─────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const verified = await verifyAuthToken(request);
    if (!verified) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const snap = await getDoc(doc(db, "orders", id));

    if (!snap.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(
      { order: { id: snap.id, ...snap.data() } },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    console.error("Order fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

// ─── PATCH /api/orders/[id] ───────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const verified = await verifyAuthToken(request);
    if (!verified) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body   = await request.json() as Record<string, unknown>;

    // ── Input Validation ────────────────────────────────────────────────────

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status as OrderStatus)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (body.paymentStatus !== undefined) {
      if (!VALID_PAYMENT_STATUSES.includes(body.paymentStatus as PaymentStatus)) {
        return NextResponse.json(
          { error: `Invalid paymentStatus. Must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (body.paymentMode !== undefined) {
      if (!VALID_PAYMENT_MODES.includes(body.paymentMode as PaymentMode)) {
        return NextResponse.json(
          { error: `Invalid paymentMode. Must be one of: ${VALID_PAYMENT_MODES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    // ── Read Existing Order ─────────────────────────────────────────────────

    const orderRef  = doc(db, "orders", id);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const existingOrder = (orderSnap.data() ?? {}) as ExistingOrderData;
    const nextStatus    = (body.status as OrderStatus) ?? existingOrder.status;

    // ── Build Update Payload ────────────────────────────────────────────────

    const updateData: Record<string, unknown> = {
      updatedAt:    serverTimestamp(),
      updatedByUid: verified.uid,
    };

    if (body.status)        updateData.status        = body.status;
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.paymentMode)   updateData.paymentMode   = body.paymentMode;

    // Sync isPaid flag with paymentStatus
    if (body.paymentStatus === "paid") {
      updateData.isPaid = true;
      updateData.paidAt = serverTimestamp();
    } else if (body.paymentStatus === "unpaid" || body.paymentStatus === "refunded") {
      updateData.isPaid = false;
    }

    await updateDoc(orderRef, updateData);

    // ── Side Effects on Terminal Status ─────────────────────────────────────
    // When order completes/cancels:
    // 1. Release table (make available for next customer)
    // 2. End session (mark ENDED so getActiveSession returns null)
    // 3. Both run in parallel — independent operations

    if (nextStatus && TERMINAL_STATUSES.includes(nextStatus)) {
      const endReason = nextStatus === "cancelled"
        ? "order_cancelled"
        : "order_completed";

      await Promise.allSettled([
        existingOrder.tableId
          ? updateDoc(doc(db, "tables", existingOrder.tableId), {
              status:           "available",
              currentOrderId:   null,
              currentSessionId: null,
              occupiedBy:       null,
              occupiedByUid:    null,
              occupiedAt:       null,
              reservedByUid:    null,
              reservedBy:       null,
              reservedAt:       null,
              clearedAt:        serverTimestamp(),
              updatedAt:        serverTimestamp(),
            })
          : Promise.resolve(),

        existingOrder.sessionId
          ? updateDoc(doc(db, "sessions", existingOrder.sessionId), {
              status:       "ENDED",
              endedAt:      serverTimestamp(),
              endReason,
              lastActivity: serverTimestamp(),
              updatedAt:    serverTimestamp(),
            })
          : Promise.resolve(),
      ]);
    }

    // ── Return Response ─────────────────────────────────────────────────────
    // Construct from known data — avoids a second Firestore read.

    return NextResponse.json(
      {
        order: {
          id,
          ...existingOrder,
          ...updateData,
          updatedAt: new Date().toISOString(),
          ...(body.paymentStatus === "paid" ? { paidAt: new Date().toISOString() } : {}),
        },
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );

  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}