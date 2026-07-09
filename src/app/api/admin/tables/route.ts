import {
  db,
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  getDoc,
} from "@/lib/firebase-admin";
import QRCode from "qrcode";
import { signTableQrToken } from "@/lib/qr-token";

export const dynamic = "force-dynamic";

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ||
  "a0000000-0000-0000-0000-000000000001";

const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;

    const q = query(
      collection(db, "tables"),
      where("restaurantId", "==", restaurantId)
    );

    const snapshot = await getDocs(q);

    const tables = snapshot.docs
      .map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          restaurantId: data.restaurantId || restaurantId,
          number: Number(data.number || 0),
          name: data.name || `Table ${data.number || ""}`,
          capacity: Number(data.capacity || 4),
          status: data.status || "available",
          qrCode: data.qrCode || "",
          currentOrderId: data.currentOrderId || null,
          currentSessionId: data.currentSessionId || null,
          occupiedBy: data.occupiedBy || null,
          occupiedAt: data.occupiedAt || null,
          clearedAt: data.clearedAt || null,
        };
      })
      .sort((a, b) => a.number - b.number);

    return Response.json(
      { tables },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    console.error("Tables GET error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId || RESTAURANT_ID;

    const tableData = {
      restaurantId,
      number: Number(body.number),
      name: body.name || `Table ${body.number}`,
      capacity: Number(body.capacity || 4),
      status: "available",
      qrCode: "",
      currentOrderId: null,
      currentSessionId: null,
      occupiedBy: null,
      occupiedAt: null,
      clearedAt: null,
      isBlocked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "tables"), tableData);

    // ✅ signed QR token
    const qrToken = signTableQrToken({
      restaurantId,
      tableId: docRef.id,
      tableNumber: Number(body.number),
      branchId: null,
    });

    const tableUrl = `${BASE_URL}/menu?q=${encodeURIComponent(qrToken)}`;
    const qrDataUrl = await QRCode.toDataURL(tableUrl, {
      width: 512,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });

    await updateDoc(docRef, {
      qrCode: qrDataUrl,
      qrToken,
      updatedAt: serverTimestamp(),
    });

    const freshSnap = await getDoc(doc(db, "tables", docRef.id));

    return Response.json(
      { table: { id: docRef.id, ...freshSnap.data() } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tables POST error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...rest } = body;

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    const ref = doc(db, "tables", id);

    await updateDoc(ref, {
      ...rest,
      updatedAt: serverTimestamp(),
    });

    const freshSnap = await getDoc(ref);

    return Response.json({ table: { id, ...freshSnap.data() } });
  } catch (error) {
    console.error("Tables PUT error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    await deleteDoc(doc(db, "tables", id));
    return Response.json({ success: true });
  } catch (error) {
    console.error("Tables DELETE error:", error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}