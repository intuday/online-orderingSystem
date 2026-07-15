// src/app/api/admin/menu/route.ts
import { NextRequest }    from "next/server";
import {
  db, collection, getDocs,
  addDoc, doc, updateDoc, deleteDoc,
  query, where, orderBy,
  serverTimestamp, adminAuth,
}                         from "@/lib/firebase-admin";
import { slugify }        from "@/lib/utils";
import type { MenuItem }  from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// Fields that can be updated via PUT
// rating, reviewCount, orderCount are managed by the system — not via this endpoint
const ALLOWED_MENU_FIELDS = new Set([
  "name", "slug", "description", "price", "comparePrice",
  "image", "categoryId", "isVeg", "isAvailable", "isFeatured",
  "isPopular", "isTodaySpecial", "isRecommended", "spiceLevel",
  "prepTime", "calories", "allergens", "ingredients",
  "variants", "addons", "sortOrder",
]);

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

// ─── GET /api/admin/menu ──────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId     = searchParams.get("restaurantId") ?? RESTAURANT_ID;

    const snapshot = await getDocs(
      query(
        collection(db, "products"),
        where("restaurantId", "==", restaurantId),
        orderBy("sortOrder", "asc")
      )
    );

    const items = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as MenuItem[];

    return Response.json({ items });

  } catch (error) {
    console.error("Menu GET error:", error);
    return Response.json({ error: "Failed to fetch menu items" }, { status: 500 });
  }
}

// ─── POST /api/admin/menu ─────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const adminUid = await verifyAdmin(request);
    if (!adminUid) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;

    // Validate required fields
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return Response.json({ error: "Item name is required" }, { status: 400 });
    }

    const price = Number(body.price);
    if (!price || price <= 0) {
      return Response.json({ error: "Valid price is required" }, { status: 400 });
    }

    const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
    if (!categoryId) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    const restaurantId = typeof body.restaurantId === "string"
      ? body.restaurantId
      : RESTAURANT_ID;

    const itemData = {
      restaurantId,
      name,
      slug:           slugify(name),
      description:    typeof body.description  === "string"  ? body.description  : "",
      price,
      comparePrice:   typeof body.comparePrice === "number"  ? body.comparePrice : null,
      image:          typeof body.image        === "string"  ? body.image        : "",
      categoryId,
      isVeg:          body.isVeg          !== false,
      isAvailable:    body.isAvailable    !== false,
      isFeatured:     body.isFeatured     === true,
      isPopular:      body.isPopular      === true,
      isTodaySpecial: body.isTodaySpecial === true,
      isRecommended:  body.isRecommended  === true,
      spiceLevel:     typeof body.spiceLevel === "number" ? body.spiceLevel : 0,
      prepTime:       typeof body.prepTime   === "number" ? body.prepTime   : 15,
      calories:       typeof body.calories   === "number" ? body.calories   : null,
      allergens:      Array.isArray(body.allergens)    ? body.allergens    : [],
      ingredients:    Array.isArray(body.ingredients)  ? body.ingredients  : [],
      variants:       Array.isArray(body.variants)     ? body.variants     : [],
      addons:         Array.isArray(body.addons)       ? body.addons       : [],
      rating:         0,
      reviewCount:    0,
      orderCount:     0,
      sortOrder:      typeof body.sortOrder === "number" ? body.sortOrder : 0,
      createdAt:      serverTimestamp(),
      updatedAt:      serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "products"), itemData);

    return Response.json(
      {
        item: {
          id: docRef.id,
          ...itemData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Menu POST error:", error);
    return Response.json({ error: "Failed to create menu item" }, { status: 500 });
  }
}

// ─── PUT /api/admin/menu ──────────────────────────────────────────────────────

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

    // Whitelist — rating, reviewCount, orderCount cannot be changed via this endpoint
    const updateData: Record<string, unknown> = { updatedAt: serverTimestamp() };
    for (const [key, value] of Object.entries(raw)) {
      if (ALLOWED_MENU_FIELDS.has(key)) {
        updateData[key] = value;
      }
    }

    // Auto-generate slug if name changed
    if (typeof raw.name === "string" && raw.name.trim()) {
      updateData.name = raw.name.trim();
      updateData.slug = slugify(raw.name.trim());
    }

    await updateDoc(doc(db, "products", id), updateData);

    return Response.json({
      item: {
        id,
        ...updateData,
        updatedAt: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error("Menu PUT error:", error);
    return Response.json({ error: "Failed to update menu item" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/menu ───────────────────────────────────────────────────

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

    await deleteDoc(doc(db, "products", id));

    return Response.json({ success: true });

  } catch (error) {
    console.error("Menu DELETE error:", error);
    return Response.json({ error: "Failed to delete menu item" }, { status: 500 });
  }
}