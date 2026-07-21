// src/app/api/qr/resolve/route.ts
//
// Validates a signed QR token and returns table information.
// This route does NOT reserve the table.
// Actual reservation happens in /api/session after user authentication.

import { NextRequest, NextResponse } from "next/server";
import { db, doc, getDoc }           from "@/lib/firebase-admin";
import { verifyTableQrToken }        from "@/lib/qr-token";

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTableData {
  restaurantId?:     string;
  number?:           number | string;
  name?:             string;
  status?:           string;
  isBlocked?:        boolean;
  currentSessionId?: string | null;
  currentOrderId?:   string | null;
  reservedByUid?:    string | null;
  occupiedByUid?:    string | null;
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body  = await req.json() as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";

    if (!token) {
      return NextResponse.json(
        { valid: false, error: "QR token is required" },
        { status: 400 }
      );
    }

    let payload: ReturnType<typeof verifyTableQrToken>;
    try {
      payload = verifyTableQrToken(token);
    } catch {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired QR code" },
        { status: 400 }
      );
    }

    const [restaurantSnap, tableSnap] = await Promise.all([
      getDoc(doc(db, "restaurants", payload.restaurantId)),
      getDoc(doc(db, "tables", payload.tableId)),
    ]);

    if (!restaurantSnap.exists()) {
      return NextResponse.json(
        { valid: false, error: "Restaurant not found" },
        { status: 404 }
      );
    }

    if (!tableSnap.exists()) {
      return NextResponse.json(
        { valid: false, error: "Table not found" },
        { status: 404 }
      );
    }

    const tableData = tableSnap.data() as RawTableData;

    if (
      tableData.restaurantId &&
      tableData.restaurantId !== payload.restaurantId
    ) {
      return NextResponse.json(
        { valid: false, error: "Invalid QR mapping" },
        { status: 400 }
      );
    }

    if (tableData.isBlocked === true) {
      return NextResponse.json(
        { valid: false, error: "This table is currently unavailable" },
        { status: 403 }
      );
    }

    const tableNumber = tableData.number ?? payload.tableNumber ?? "";
    const tableStatus = tableData.status ?? "available";

    return NextResponse.json({
      valid: true,
      table: {
        id:               tableSnap.id,
        number:           tableNumber,
        name:             tableData.name ?? `Table ${tableNumber}`,
        status:           tableStatus,
        restaurantId:     payload.restaurantId,
        currentSessionId: tableData.currentSessionId ?? null,
        currentOrderId:   tableData.currentOrderId ?? null,
      },
    });

  } catch (error) {
    console.error("QR resolve error:", error);
    return NextResponse.json(
      { valid: false, error: "Failed to resolve QR code" },
      { status: 500 }
    );
  }
}