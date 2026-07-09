// scripts/seed-admin.ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { hash } from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const app =
  getApps().length === 0
    ? initializeApp({
        credential: cert({
          projectId:   process.env.FIREBASE_PROJECT_ID!,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
          privateKey:  process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        }),
      })
    : getApps()[0];

const db = getFirestore(app);

async function seedAdmin() {
  console.log("🔐 Creating admin user...\n");

  const email    = "admin@spicegarden.com";
  const password = "admin123";  // ⚠️ Baad mein change karo

  const hashedPassword = await hash(password, 12);

  await db.collection("admins").doc("admin-001").set({
    email,
    password:     hashedPassword,
    name:         "Admin",
    role:         "admin",
    restaurantId: "a0000000-0000-0000-0000-000000000001",
    createdAt:    new Date(),
  });

  console.log("✅ Admin user created!");
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log("\n⚠️  Change password after first login!");

  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});