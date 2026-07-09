import { NextRequest, NextResponse } from "next/server";
import { db, doc, getDoc } from "@/lib/firebase-admin";
import { verifyTableQrToken } from "@/lib/qr-token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "QR token required" }, { status: 400 });
    }

    const payload = verifyTableQrToken(token);

    const restaurantRef = doc(db, "restaurants", payload.restaurantId);
    const restaurantSnap = await getDoc(restaurantRef);

    if (!restaurantSnap.exists()) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const tableRef = doc(db, "tables", payload.tableId);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    const tableData = tableSnap.data() as any;

    if (tableData.restaurantId && tableData.restaurantId !== payload.restaurantId) {
      return NextResponse.json({ error: "Invalid QR mapping" }, { status: 400 });
    }

    if (tableData.isBlocked === true) {
      return NextResponse.json({ error: "Table is blocked" }, { status: 403 });
    }

    return NextResponse.json({
      valid: true,
      table: {
        id: tableSnap.id,
        number: tableData.number || payload.tableNumber || "",
        name: tableData.name || `Table ${tableData.number || payload.tableNumber || ""}`,
        status: tableData.status || "available",
        restaurantId: payload.restaurantId,
      },
    });
  } catch (error) {
    console.error("QR resolve error:", error);
    return NextResponse.json({ error: "Invalid or expired QR" }, { status: 400 });
  }
}