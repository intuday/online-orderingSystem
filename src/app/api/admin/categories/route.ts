// src/app/api/admin/categories/route.ts
import { NextRequest }        from "next/server";
import {
  db, collection, getDocs,
  addDoc, doc, updateDoc, deleteDoc,
  query, where, orderBy,
  serverTimestamp,
}                             from "@/lib/firebase-admin";
import { verifyAdmin }        from "@/lib/auth/server-auth";
import { slugify }            from "@/lib/utils";
import type { Category }      from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// Fields that can be set/updated via this endpoint
const ALLOWED_FIELDS = new Set([
  "name", "icon", "image", "sortOrder", "isActive", "slug",
]);

// ─── GET /api/admin/categories ────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const snapshot = await getDocs(
      query(
        collection(db, "categories"),
        where("restaurantId", "==", restaurantId),
        orderBy("sortOrder", "asc")
      )
    );

    const categories = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Category[];

    return Response.json({ categories });

  } catch (error) {
    console.error("Categories GET error:", error);
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

// ─── POST /api/admin/categories ───────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body         = await request.json() as Record<string, unknown>;
    const restaurantId = typeof body.restaurantId === "string"
      ? body.restaurantId
      : RESTAURANT_ID;
    const name         = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return Response.json({ error: "Category name is required" }, { status: 400 });
    }

    const categoryData = {
      restaurantId,
      name,
      slug:      slugify(name),
      icon:      typeof body.icon  === "string" ? body.icon  : "",
      image:     typeof body.image === "string" ? body.image : "",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
      isActive:  body.isActive !== false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "categories"), categoryData);

    return Response.json(
      {
        category: {
          id: docRef.id,
          ...categoryData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Categories POST error:", error);
    return Response.json({ error: "Failed to create category" }, { status: 500 });
  }
}

// ─── PUT /api/admin/categories ────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body           = await request.json() as Record<string, unknown>;
    const { id, ...raw } = body;

    if (!id || typeof id !== "string") {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    // Whitelist — only allowed fields can be updated
    const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [key, value] of Object.entries(raw)) {
      if (ALLOWED_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    // Auto-generate slug if name changed
    if (typeof raw.name === "string" && raw.name.trim()) {
      updateData.name = raw.name.trim();
      updateData.slug = slugify(raw.name.trim());
    }

    await updateDoc(doc(db, "categories", id), updateData);

    return Response.json({
      category: {
        id,
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Categories PUT error:", error);
    return Response.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/categories ────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id               = searchParams.get("id");

    if (!id) {
      return Response.json({ error: "ID required" }, { status: 400 });
    }

    await deleteDoc(doc(db, "categories", id));

    return Response.json({ success: true });

  } catch (error) {
    console.error("Categories DELETE error:", error);
    return Response.json({ error: "Failed to delete category" }, { status: 500 });
  }
}