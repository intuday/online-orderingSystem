import {
  db, collection, getDocs, addDoc, doc,
  updateDoc, deleteDoc, query, where, orderBy, serverTimestamp,
} from "@/lib/firebase-admin";
import { slugify } from "@/lib/utils";
import type { Category } from "@/lib/firebase"; // ✅ firebase-admin nahi, firebase se

export const dynamic = "force-dynamic";

const RESTAURANT_ID = process.env.NEXT_PUBLIC_RESTAURANT_ID || "a0000000-0000-0000-0000-000000000001";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || RESTAURANT_ID;

    // ✅ orderBy hata diya - index nahi chahiye
    const q = query(
      collection(db, "categories"),
      where("restaurantId", "==", restaurantId)
    );
    const snapshot = await getDocs(q);
    const categories = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) as Category[];

    return Response.json({ categories });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId || RESTAURANT_ID;

    const categoryData = {
      restaurantId,
      name:      body.name,
      slug:      slugify(body.name),
      icon:      body.icon  || "",
      image:     body.image || "",
      sortOrder: body.sortOrder || 0,
      isActive:  body.isActive !== false,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "categories"), categoryData);
    return Response.json(
      { category: { id: docRef.id, ...categoryData } },
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

    if (updateData.name) {
      updateData.slug = slugify(updateData.name);
    }

    await updateDoc(doc(db, "categories", id), updateData);
    return Response.json({ category: { id, ...updateData } });
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

    await deleteDoc(doc(db, "categories", id));
    return Response.json({ success: true });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}