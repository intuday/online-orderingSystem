import { NextRequest, NextResponse } from "next/server";
import { db, doc, getDoc, updateDoc, serverTimestamp } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

const TERMINAL_STATUSES = ["completed", "cancelled"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ref = doc(db, "orders", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order: { id: snap.id, ...snap.data() } });
  } catch (error) {
    console.error("Order fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const orderRef = doc(db, "orders", id);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists()) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const existingOrder = orderSnap.data() as any;

    const nextStatus = body.status ?? existingOrder.status;
    const nextPaymentStatus = body.paymentStatus ?? existingOrder.paymentStatus;

    const updateData: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (body.status) updateData.status = body.status;
    if (body.paymentStatus) updateData.paymentStatus = body.paymentStatus;
    if (body.paymentMode) updateData.paymentMode = body.paymentMode;

    if (body.paymentStatus === "paid") {
      updateData.isPaid = true;
      updateData.paidAt = serverTimestamp();
    }

    await updateDoc(orderRef, updateData);

    // ✅ table release on completed/cancelled
    if (existingOrder.tableId && TERMINAL_STATUSES.includes(nextStatus)) {
      try {
        await updateDoc(doc(db, "tables", existingOrder.tableId), {
          status: "available",
          currentOrderId: null,
          currentSessionId: null,
          occupiedBy: null,
          occupiedAt: null,
          clearedAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("Table release error:", e);
      }
    }

    // ✅ end session too
    if (existingOrder.sessionId && TERMINAL_STATUSES.includes(nextStatus)) {
      try {
        await updateDoc(doc(db, "sessions", existingOrder.sessionId), {
          status: "ENDED",
          endedAt: serverTimestamp(),
          endReason: "order_finished",
          lastActivity: serverTimestamp(),
        });
      } catch (e) {
        console.error("Session end error:", e);
      }
    }

    const updatedSnap = await getDoc(orderRef);

    return NextResponse.json({
      order: { id: updatedSnap.id, ...updatedSnap.data() },
    });
  } catch (error) {
    console.error("Order update error:", error);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}