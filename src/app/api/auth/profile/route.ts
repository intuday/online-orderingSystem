import { NextRequest, NextResponse } from "next/server";
import {
  db,
  adminAuth,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const body = await req.json();

    const userRef = doc(db, "users", uid);
    const snap    = await getDoc(userRef);

    if (snap.exists()) {
      return NextResponse.json({ profile: snap.data() });
    }

    const newProfile = {
      uid,
      email:       body.email       ?? null,
      displayName: body.displayName ?? null,
      photoURL:    body.photoURL    ?? null,
      phone:       body.phone       ?? null,
      role:        "customer",
      createdAt:   serverTimestamp(),
      updatedAt:   serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    return NextResponse.json({ profile: newProfile });

  } catch (err) {
    console.error("Profile API error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}