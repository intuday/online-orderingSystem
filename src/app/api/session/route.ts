// src/app/api/session/route.ts
//
// Creates and manages dine-in table sessions.
// A session binds:
//   user  <->  table  <->  restaurant
//
// Rules:
// - Only authenticated users can create a session
// - If the table is reserved/occupied by another user, block with 409
// - If the same user scans the same table again, reuse the session
// - If the same user has an active session on another RESERVED table, close it
// - If the same user has an active session on another OCCUPIED table, block switching

import { NextRequest, NextResponse } from "next/server";
import {
  adminAuth,
  db,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  limit,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "@/lib/firebase-admin";
import { verifyTableQrToken } from "@/lib/qr-token";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifiedUser {
  uid:   string;
  email: string;
}

interface UserProfileData {
  name?:        string;
  displayName?: string;
  phone?:       string;
  email?:       string;
  role?:        string;
}

interface TableData {
  restaurantId?:     string;
  number?:           number | string;
  name?:             string;
  status?:           string;
  isBlocked?:        boolean;
  currentSessionId?: string | null;
  currentOrderId?:   string | null;
  reservedByUid?:    string | null;
  reservedBy?:       string | null;
  reservedAt?:       unknown;
  occupiedByUid?:    string | null;
  occupiedBy?:       string | null;
  occupiedAt?:       unknown;
}

interface SessionData {
  userId?:       string;
  userName?:     string;
  userEmail?:    string;
  userPhone?:    string;
  restaurantId?: string;
  tableId?:      string;
  tableNumber?:  number | string;
  status?:       "ACTIVE" | "ENDED" | "EXPIRED";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function verifyUserFromCookie(req: NextRequest): Promise<VerifiedUser | null> {
  const token = req.cookies.get("auth-token")?.value;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return {
      uid:   decoded.uid,
      email: decoded.email ?? "",
    };
  } catch {
    return null;
  }
}

async function resolveTableByIdOrNumber(
  tableValue: string,
  restaurantId?: string
): Promise<{ id: string; data: TableData } | null> {
  // 1. Try direct doc id
  const byIdSnap = await getDoc(doc(db, "tables", tableValue));
  if (byIdSnap.exists()) {
    return { id: byIdSnap.id, data: byIdSnap.data() as TableData };
  }

  // 2. Try numeric table number
  const tableNumber = Number(tableValue);
  if (!Number.isNaN(tableNumber)) {
    const filters = [where("number", "==", tableNumber)];

    if (restaurantId) {
      filters.unshift(where("restaurantId", "==", restaurantId));
    }

    const q = query(collection(db, "tables"), ...filters, limit(1));
    const snap = await getDocs(q);

    if (!snap.empty) {
      return {
        id:   snap.docs[0].id,
        data: snap.docs[0].data() as TableData,
      };
    }
  }

  return null;
}

async function getUserProfile(uid: string): Promise<UserProfileData> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return {};
  return snap.data() as UserProfileData;
}

async function getActiveSession(uid: string): Promise<{ id: string; data: SessionData } | null> {
  const snap = await getDocs(
    query(
      collection(db, "sessions"),
      where("userId", "==", uid),
      where("status", "==", "ACTIVE"),
      limit(1)
    )
  );

  if (snap.empty) return null;

  return {
    id:   snap.docs[0].id,
    data: snap.docs[0].data() as SessionData,
  };
}

async function releaseReservedTableAndEndSession(sessionId: string, sessionData: SessionData) {
  const tasks: Promise<unknown>[] = [];

  if (sessionData.tableId) {
    tasks.push(
      updateDoc(doc(db, "tables", sessionData.tableId), {
        status:           "available",
        currentSessionId: null,
        reservedByUid:    null,
        reservedBy:       null,
        reservedAt:       null,
        updatedAt:        serverTimestamp(),
      })
    );
  }

  tasks.push(
    updateDoc(doc(db, "sessions", sessionId), {
      status:       "ENDED",
      endedAt:      serverTimestamp(),
      endReason:    "manual",
      lastActivity: serverTimestamp(),
      updatedAt:    serverTimestamp(),
    })
  );

  await Promise.allSettled(tasks);
}

// ─── GET /api/session ─────────────────────────────────────────────────────────
// Returns current authenticated user's active session (if any)

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const verified = await verifyUserFromCookie(req);

    if (!verified) {
      return NextResponse.json(
        { authenticated: false, session: null },
        { status: 401 }
      );
    }

    const activeSession = await getActiveSession(verified.uid);

    if (!activeSession) {
      return NextResponse.json({
        authenticated: true,
        session:       null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      session: {
        id: activeSession.id,
        ...activeSession.data,
      },
    });
  } catch (error) {
    console.error("Session GET error:", error);
    return NextResponse.json(
      { authenticated: false, session: null },
      { status: 500 }
    );
  }
}

// ─── POST /api/session ────────────────────────────────────────────────────────
// Creates or reuses a dine-in table session

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const verified = await verifyUserFromCookie(req);

    if (!verified) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please login first" },
        { status: 401 }
      );
    }

    const body = await req.json() as Record<string, unknown>;

    const qrToken      = typeof body.qrToken      === "string" ? body.qrToken.trim()      : "";
    const rawTableId   = typeof body.tableId      === "string" ? body.tableId.trim()      : "";
    const bodyRestId   = typeof body.restaurantId === "string" ? body.restaurantId.trim() : DEFAULT_RESTAURANT_ID;

    let targetRestaurantId = bodyRestId;
    let targetTableId      = "";
    let targetTableNumber: string | number | null = null;

    // ── Resolve target table ────────────────────────────────────────────────

    if (qrToken) {
      const payload = verifyTableQrToken(qrToken);
      targetRestaurantId = payload.restaurantId;
      targetTableId      = payload.tableId;
      targetTableNumber  = payload.tableNumber ?? null;
    } else if (rawTableId) {
      const resolved = await resolveTableByIdOrNumber(rawTableId, bodyRestId);
      if (!resolved) {
        return NextResponse.json(
          { error: "table_not_found", message: "Table not found" },
          { status: 404 }
        );
      }
      targetRestaurantId = resolved.data.restaurantId ?? bodyRestId;
      targetTableId      = resolved.id;
      targetTableNumber  = resolved.data.number ?? null;
    } else {
      return NextResponse.json(
        { error: "table_required", message: "QR token or tableId is required" },
        { status: 400 }
      );
    }

    const tableSnap = await getDoc(doc(db, "tables", targetTableId));

    if (!tableSnap.exists()) {
      return NextResponse.json(
        { error: "table_not_found", message: "Table not found" },
        { status: 404 }
      );
    }

    const tableData = tableSnap.data() as TableData;

    // Security — table must belong to same restaurant
    if (
      tableData.restaurantId &&
      tableData.restaurantId !== targetRestaurantId
    ) {
      return NextResponse.json(
        { error: "invalid_qr", message: "Invalid table mapping" },
        { status: 400 }
      );
    }

    if (tableData.isBlocked === true) {
      return NextResponse.json(
        { error: "table_blocked", message: "This table is currently unavailable" },
        { status: 403 }
      );
    }

    // ── Current user profile ────────────────────────────────────────────────

    const profile  = await getUserProfile(verified.uid);
    const userName = profile.name || profile.displayName || verified.email.split("@")[0] || "Guest";
    const userPhone = profile.phone || "";
    const userEmail = profile.email || verified.email || "";

    // ── Check existing ACTIVE session for this user ─────────────────────────

    const existingSession = await getActiveSession(verified.uid);

    // Same user rescanned the SAME table → reuse existing session
    if (
      existingSession &&
      existingSession.data.tableId === targetTableId &&
      existingSession.data.status === "ACTIVE"
    ) {
      return NextResponse.json({
        success: true,
        session: {
          id: existingSession.id,
          ...existingSession.data,
        },
        reused: true,
      });
    }

    // Same user has another ACTIVE session
    if (
      existingSession &&
      existingSession.data.tableId &&
      existingSession.data.tableId !== targetTableId
    ) {
      const oldTableSnap = await getDoc(doc(db, "tables", existingSession.data.tableId));

      if (oldTableSnap.exists()) {
        const oldTable = oldTableSnap.data() as TableData;
        const oldStatus = oldTable.status ?? "available";

        // If old session table is reserved only, safely close and switch
        if (
          oldStatus === "reserved" &&
          oldTable.currentSessionId === existingSession.id
        ) {
          await releaseReservedTableAndEndSession(existingSession.id, existingSession.data);
        } else {
          // If old table is occupied, user must complete/close first
          return NextResponse.json(
            {
              error:   "active_session_exists",
              message: "You already have an active table session/order on another table.",
            },
            { status: 409 }
          );
        }
      }
    }

    // ── Check target table ownership / occupancy ────────────────────────────

    const tableStatus = tableData.status ?? "available";

    const sameReservedUser = tableData.reservedByUid === verified.uid;
    const sameOccupiedUser = tableData.occupiedByUid === verified.uid;

    if (tableStatus === "reserved" && !sameReservedUser) {
      return NextResponse.json(
        {
          error:   "table_in_use",
          message: "This table is currently in use by another guest.",
        },
        { status: 409 }
      );
    }

    if (tableStatus === "occupied" && !sameOccupiedUser) {
      return NextResponse.json(
        {
          error:   "table_occupied",
          message: "This table already has an active order.",
        },
        { status: 409 }
      );
    }

    // ── Create new / recovered session ──────────────────────────────────────

    const now       = Date.now();
    const expiresAt = new Date(now + SESSION_TTL_MS);

    const sessionData = {
      userId:       verified.uid,
      userName,
      userEmail,
      userPhone,
      restaurantId: targetRestaurantId,
      tableId:      targetTableId,
      tableNumber:  targetTableNumber ?? tableData.number ?? null,
      status:       "ACTIVE",
      startTime:    serverTimestamp(),
      lastActivity: serverTimestamp(),
      expiresAt,
      ordersCount:  0,
      totalSpent:   0,
      createdAt:    serverTimestamp(),
      updatedAt:    serverTimestamp(),
    };

    const sessionRef = await addDoc(collection(db, "sessions"), sessionData);

    // Reserve table if not already occupied by same user
    const nextTableStatus = tableStatus === "occupied" ? "occupied" : "reserved";

    await updateDoc(doc(db, "tables", targetTableId), {
      status:           nextTableStatus,
      currentSessionId: sessionRef.id,
      reservedByUid:    verified.uid,
      reservedBy:       userName,
      reservedAt:       serverTimestamp(),
      updatedAt:        serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      session: {
        id: sessionRef.id,
        ...sessionData,
        expiresAt: expiresAt.toISOString(),
      },
      reused: false,
    });

  } catch (error) {
    console.error("Session POST error:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}