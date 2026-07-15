// src/app/api/admin/customers/route.ts
import { NextRequest }         from "next/server";
import {
  db, collection, getDocs,
  doc, updateDoc, deleteDoc,
  query, where, orderBy, limit,
}                              from "@/lib/firebase-admin";
import { adminAuth }           from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const ORDERS_PER_CUSTOMER_LIMIT = 200;

// Fields that can be updated via this endpoint — whitelist only
const ALLOWED_UPDATE_FIELDS = new Set(["name", "phone", "email"]);

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawOrder {
  id:            string;
  customerId?:   string;
  customerName?: string;
  customerPhone?: string;
  total?:        number;
  status?:       string;
  paymentStatus?: string;
  createdAt?:    unknown;
}

interface RawUser {
  name?:        string;
  displayName?: string;
  email?:       string;
  phone?:       string;
  createdAt?:   unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractSeconds(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const v = value as Record<string, unknown>;
  if (typeof v._seconds === "number") return v._seconds;
  if (typeof v.seconds  === "number") return v.seconds;
  return 0;
}

/**
 * Verifies the auth-token cookie and returns uid if admin/super_admin.
 * Returns null if unauthorized.
 */
async function verifyAdmin(request: Request): Promise<string | null> {
  const req   = request as NextRequest;
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;

  try {
    const decoded  = await adminAuth.verifyIdToken(token);
    const uid      = decoded.uid;
    const userSnap = await getDocs(
      query(collection(db, "users"), where("__name__", "==", uid))
    );
    if (userSnap.empty) return null;
    const role = userSnap.docs[0].data().role as string;
    if (role !== "admin" && role !== "super_admin") return null;
    return uid;
  } catch {
    return null;
  }
}

// ─── GET /api/admin/customers ─────────────────────────────────────────────────

export async function GET() {
  try {
    // Fetch registered customers and recent orders in parallel
    const [usersSnap, ordersSnap] = await Promise.all([
      getDocs(
        query(
          collection(db, "users"),
          where("role", "==", "customer")
        )
      ),
      getDocs(
        query(
          collection(db, "orders"),
          where("restaurantId", "==", RESTAURANT_ID),
          orderBy("createdAt", "desc"),
          limit(ORDERS_PER_CUSTOMER_LIMIT)
        )
      ),
    ]);

    const orders = ordersSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as RawOrder[];

    // ── Group orders by phone and customerId in a single pass ───────────────
    const ordersByPhone:      Record<string, RawOrder[]> = {};
    const ordersByCustomerId: Record<string, RawOrder[]> = {};

    for (const order of orders) {
      if (order.customerPhone) {
        (ordersByPhone[order.customerPhone] ??= []).push(order);
      }
      if (order.customerId) {
        (ordersByCustomerId[order.customerId] ??= []).push(order);
      }
    }

    const customerMap = new Map<string, unknown>();

    // ── Registered users ────────────────────────────────────────────────────
    for (const d of usersSnap.docs) {
      const data   = d.data() as RawUser;
      const phone  = data.phone ?? "";
      const key    = phone || d.id;

      const customerOrders = [
        ...(ordersByCustomerId[d.id]   ?? []),
        ...(ordersByPhone[phone]       ?? []),
      ];

      // Deduplicate by order id
      const seen        = new Set<string>();
      const uniqueOrders = customerOrders.filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      });

      // Sort once — used for both lastOrderAt and lastOrderStatus
      const sortedOrders = [...uniqueOrders].sort(
        (a, b) => extractSeconds(b.createdAt) - extractSeconds(a.createdAt)
      );

      const lastOrder = sortedOrders[0];

      customerMap.set(key, {
        id:              d.id,
        name:            data.name || data.displayName || "Unknown",
        email:           data.email  ?? null,
        phone:           phone       || null,
        totalOrders:     uniqueOrders.length,
        totalSpent:      uniqueOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
        lastOrderAt:     lastOrder?.createdAt ?? null,
        lastOrderStatus: lastOrder?.status    ?? null,
        createdAt:       data.createdAt       ?? null,
        source:          "registered",
      });
    }

    // ── Guest customers (ordered but never registered) ──────────────────────
    for (const order of orders) {
      const phone = order.customerPhone;
      if (!phone || customerMap.has(phone)) continue;

      const guestOrders  = ordersByPhone[phone] ?? [];
      const sortedGuest  = [...guestOrders].sort(
        (a, b) => extractSeconds(a.createdAt) - extractSeconds(b.createdAt)
      );
      const lastOrder    = guestOrders.sort(
        (a, b) => extractSeconds(b.createdAt) - extractSeconds(a.createdAt)
      )[0];

      customerMap.set(phone, {
        id:              phone,
        name:            order.customerName ?? "Guest",
        email:           null,
        phone,
        totalOrders:     guestOrders.length,
        totalSpent:      guestOrders.reduce((s, o) => s + (Number(o.total) || 0), 0),
        lastOrderAt:     lastOrder?.createdAt   ?? null,
        lastOrderStatus: lastOrder?.status      ?? null,
        createdAt:       sortedGuest[0]?.createdAt ?? order.createdAt ?? null,
        source:          "guest",
      });
    }

    // ── Sort by most recent order ───────────────────────────────────────────
    const customers = Array.from(customerMap.values()).sort((a, b) => {
      const aT = extractSeconds((a as Record<string, unknown>).lastOrderAt);
      const bT = extractSeconds((b as Record<string, unknown>).lastOrderAt);
      return bT - aT;
    });

    return Response.json({ customers });

  } catch (error) {
    console.error("Customers error:", error);
    return Response.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

// ─── PUT /api/admin/customers ─────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;
    const { id, ...rawUpdate } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    // Whitelist — only allowed fields can be updated
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawUpdate)) {
      if (ALLOWED_UPDATE_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    await updateDoc(doc(db, "users", id), updateData);

    return Response.json({ customer: { id, ...updateData } });

  } catch (error) {
    console.error("Customer update error:", error);
    return Response.json({ error: "Failed to update customer" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/customers ──────────────────────────────────────────────

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

    await deleteDoc(doc(db, "users", id));

    return Response.json({ success: true });

  } catch (error) {
    console.error("Customer delete error:", error);
    return Response.json({ error: "Failed to delete customer" }, { status: 500 });
  }
}