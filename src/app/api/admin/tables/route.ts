// src/app/api/admin/tables/route.ts
import { NextRequest }          from "next/server";
import {
  db, collection, getDocs,
  addDoc, doc, updateDoc, deleteDoc,
  getDoc, query, where,
  serverTimestamp, adminAuth,
}                               from "@/lib/firebase-admin";
import QRCode                   from "qrcode";
import { signTableQrToken }     from "@/lib/qr-token";
import type { Table }           from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const BASE_URL =
  (process.env.NEXT_PUBLIC_BASE_URL ?? "https://online-orderingsystem.vercel.app")
    .replace(/\/$/, "");

// Fields that can be updated via PUT
const ALLOWED_UPDATE_FIELDS = new Set([
  "name", "number", "capacity", "status", "isBlocked",
]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTableData {
  restaurantId?:     string;
  number?:           number | string;
  name?:             string;
  capacity?:         number | string;
  status?:           string;
  qrCode?:           string;
  currentOrderId?:   string | null;
  currentSessionId?: string | null;
  occupiedBy?:       string | null;
  occupiedAt?:       unknown;
  clearedAt?:        unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyAdmin(request: Request): Promise<string | null> {
  const req   = request as NextRequest;
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;
  try {
    const decoded  = await adminAuth.verifyIdToken(token);
    const userSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", decoded.uid))
    );
    if (userSnap.empty) return null;
    const role = userSnap.docs[0].data().role as string;
    return (role === "admin" || role === "super_admin") ? decoded.uid : null;
  } catch {
    return null;
  }
}

async function generateQrCode(
  restaurantId: string,
  tableId:      string,
  tableNumber:  number
): Promise<{ qrToken: string; qrDataUrl: string }> {
  const qrToken = signTableQrToken({
    restaurantId,
    tableId,
    tableNumber,
    branchId: null,
  });
  const tableUrl  = `${BASE_URL}/menu?q=${encodeURIComponent(qrToken)}`;
  const qrDataUrl = await QRCode.toDataURL(tableUrl, {
    width:  512,
    margin: 2,
    color:  { dark: "#0f172a", light: "#ffffff" },
  });
  return { qrToken, qrDataUrl };
}

function normalizeTable(id: string, data: RawTableData, restaurantId: string): Table {
  return {
    id,
    restaurantId:  data.restaurantId  ?? restaurantId,
    number:        Number(data.number ?? 0),
    name:          data.name          ?? `Table ${data.number ?? ""}`,
    capacity:      Number(data.capacity ?? 4),
    status:        data.status        ?? "available",
    qrCode:        data.qrCode        ?? "",
  };
}

// ─── GET /api/admin/tables ────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const snapshot = await getDocs(
      query(
        collection(db, "tables"),
        where("restaurantId", "==", restaurantId)
      )
    );

    const tables = snapshot.docs
      .map((d) => normalizeTable(d.id, d.data() as RawTableData, restaurantId))
      .sort((a, b) => a.number - b.number);

    return Response.json(
      { tables },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma":        "no-cache",
          "Expires":       "0",
        },
      }
    );

  } catch (error) {
    console.error("Tables GET error:", error);
    return Response.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}

// ─── POST /api/admin/tables ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body         = await request.json() as Record<string, unknown>;
    const restaurantId = typeof body.restaurantId === "string"
      ? body.restaurantId
      : RESTAURANT_ID;
    const tableNumber  = Number(body.number);

    if (!tableNumber || tableNumber <= 0) {
      return Response.json({ error: "Valid table number is required" }, { status: 400 });
    }

    const tableData = {
      restaurantId,
      number:           tableNumber,
      name:             typeof body.name === "string" ? body.name : `Table ${tableNumber}`,
      capacity:         Number(body.capacity ?? 4),
      status:           "available",
      qrCode:           "",
      qrToken:          "",
      currentOrderId:   null,
      currentSessionId: null,
      occupiedBy:       null,
      occupiedByUid:    null,
      occupiedAt:       null,
      clearedAt:        null,
      isBlocked:        false,
      createdAt:        serverTimestamp(),
      updatedAt:        serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "tables"), tableData);

    // Generate QR after we have the document ID
    const { qrToken, qrDataUrl } = await generateQrCode(
      restaurantId,
      docRef.id,
      tableNumber
    );

    await updateDoc(docRef, {
      qrCode:    qrDataUrl,
      qrToken,
      updatedAt: serverTimestamp(),
    });

    // Return constructed response — avoids extra getDoc read
    return Response.json(
      {
        table: {
          id: docRef.id,
          ...tableData,
          qrCode:    qrDataUrl,
          qrToken,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Tables POST error:", error);
    return Response.json({ error: "Failed to create table" }, { status: 500 });
  }
}

// ─── PATCH /api/admin/tables — Regenerate QR ─────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;
    const id   = typeof body.id === "string" ? body.id : null;

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    const tableRef  = doc(db, "tables", id);
    const tableSnap = await getDoc(tableRef);

    if (!tableSnap.exists()) {
      return Response.json({ error: "Table not found" }, { status: 404 });
    }

    const tableData    = tableSnap.data() as RawTableData;
    const restaurantId = tableData.restaurantId ?? RESTAURANT_ID;
    const tableNumber  = Number(tableData.number ?? 0);

    const { qrToken, qrDataUrl } = await generateQrCode(
      restaurantId,
      id,
      tableNumber
    );

    await updateDoc(tableRef, {
      qrCode:    qrDataUrl,
      qrToken,
      updatedAt: serverTimestamp(),
    });

    // Return constructed response — avoids second getDoc read
    return Response.json({
      table: {
        ...normalizeTable(id, tableData, restaurantId),
        qrCode:    qrDataUrl,
        qrToken,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Tables PATCH error:", error);
    return Response.json({ error: "Failed to regenerate QR code" }, { status: 500 });
  }
}

// ─── PUT /api/admin/tables — Update table details ─────────────────────────────

export async function PUT(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body        = await request.json() as Record<string, unknown>;
    const { id, ...raw } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    // Whitelist — prevent arbitrary field writes (especially qrToken, restaurantId)
    const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [key, value] of Object.entries(raw)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    await updateDoc(doc(db, "tables", id), updateData);

    // Return constructed response — avoids extra getDoc read
    return Response.json({
      table: {
        id,
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Tables PUT error:", error);
    return Response.json({ error: "Failed to update table" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/tables ─────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id               = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    await deleteDoc(doc(db, "tables", id));

    return Response.json({ success: true });

  } catch (error) {
    console.error("Tables DELETE error:", error);
    return Response.json({ error: "Failed to delete table" }, { status: 500 });
  }
}