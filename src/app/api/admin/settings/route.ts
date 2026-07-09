import { db, doc, getDoc, setDoc, serverTimestamp } from "@/lib/firebase-admin";
import type { Restaurant } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || "demo-restaurant";
    
    const docRef = doc(db, "restaurants", restaurantId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return Response.json({ restaurant: { id: docSnap.id, ...docSnap.data() } });
    }
    
    const defaultRestaurant: Partial<Restaurant> = {
      name: "The Royal Kitchen",
      description: "Premium dining experience",
      logo: "",
      address: "123 MG Road, Bangalore",
      phone: "+91 98765 43210",
      email: "info@royalkitchen.com",
      gstNumber: "29ABCDE1234F1Z5",
      gstRate: 5,
      currency: "INR",
      paymentMode: "both",
      openingHours: {},
      theme: "light",
    };
    
    return Response.json({ restaurant: { id: restaurantId, ...defaultRestaurant } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const restaurantId = body.restaurantId || "demo-restaurant";
    
    const updateData = { ...body, updatedAt: serverTimestamp() };
    delete updateData.restaurantId;
    
    const docRef = doc(db, "restaurants", restaurantId);
    await setDoc(docRef, updateData, { merge: true });
    
    const docSnap = await getDoc(docRef);
    
    return Response.json({ restaurant: { id: docSnap.id, ...docSnap.data() } });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
