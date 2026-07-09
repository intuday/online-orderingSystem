import {
  db, collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, query, where, serverTimestamp,
} from "@/lib/firebase-admin";
import { slugify } from "@/lib/utils";
import type { MenuItem } from "@/lib/firebase"; // ✅ firebase se, firebase-admin se nahi

export const dynamic = "force-dynamic";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;

    // ✅ orderBy hata diya
    const q = query(
      collection(db, "products"),
      where("restaurantId", "==", restaurantId)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) as MenuItem[];

    return Response.json({ items });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId || RESTAURANT_ID;

    const itemData = {
      restaurantId,
      name:          body.name,
      slug:          slugify(body.name),
      description:   body.description   || "",
      price:         body.price,
      comparePrice:  body.comparePrice  || null,
      image:         body.image         || "",
      categoryId:    body.categoryId,
      isVeg:         body.isVeg         !== false,
      isAvailable:   body.isAvailable   !== false,
      isFeatured:    body.isFeatured    || false,
      isPopular:     body.isPopular     || false,
      isTodaySpecial: body.isTodaySpecial || false,
      isRecommended: body.isRecommended || false,
      spiceLevel:    body.spiceLevel    || 0,
      prepTime:      body.prepTime      || 15,
      calories:      body.calories      || null,
      allergens:     body.allergens     || [],
      ingredients:   body.ingredients   || [],
      variants:      body.variants      || [],
      addons:        body.addons        || [],
      rating:        0,
      reviewCount:   0,
      orderCount:    0,
      sortOrder:     body.sortOrder     || 0,
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "products"), itemData);
    return Response.json(
      { item: { id: docRef.id, ...itemData } },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (updateData.name) updateData.slug = slugify(updateData.name);
    updateData.updatedAt = serverTimestamp();

    await updateDoc(doc(db, "products", id), updateData);
    return Response.json({ item: { id, ...updateData } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

    await deleteDoc(doc(db, "products", id));
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}