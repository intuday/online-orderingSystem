// scripts/seed.ts
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
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

const RESTAURANT_ID = "a0000000-0000-0000-0000-000000000001";

async function seed() {
  console.log("🌱 Seeding Firestore...\n");

  // ── Restaurant ──────────────────────────────────────────────────────────
  await db.collection("restaurants").doc(RESTAURANT_ID).set({
    name:        "Spice Garden",
    description: "Authentic Indian cuisine with a modern twist",
    address:     "123 Food Street, Mumbai - 400001",
    phone:       "9876543210",
    email:       "info@spicegarden.com",
    currency:    "INR",
    taxRate:     5,
    isOpen:      true,
    theme: {
      primaryColor:   "#f97316",
      secondaryColor: "#ef4444",
    },
  });
  console.log("✅ Restaurant created");

  // ── Categories ──────────────────────────────────────────────────────────
  const categories = [
    { name: "Starters",    icon: "🥗", order: 1 },
    { name: "Main Course", icon: "🍛", order: 2 },
    { name: "Breads",      icon: "🫓", order: 3 },
    { name: "Rice & Biryani", icon: "🍚", order: 4 },
    { name: "Desserts",    icon: "🍮", order: 5 },
    { name: "Drinks",      icon: "🥤", order: 6 },
  ];

  const categoryIds: Record<string, string> = {};

  for (const cat of categories) {
    const ref = await db.collection("categories").add({
      ...cat,
      restaurantId: RESTAURANT_ID,
      isActive:     true,
    });
    categoryIds[cat.name] = ref.id;
    console.log(`✅ Category: ${cat.name} (${ref.id})`);
  }

  // ── Products ────────────────────────────────────────────────────────────
  const products = [
    // Starters
    {
      name:          "Paneer Tikka",
      description:   "Grilled cottage cheese marinated in spices",
      price:         280,
      comparePrice:  350,
      categoryId:    categoryIds["Starters"],
      isVeg:         true,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    2,
      rating:        4.5,
      reviewCount:   128,
      prepTime:      15,
      calories:      320,
      image:         "",
    },
    {
      name:          "Veg Spring Rolls",
      description:   "Crispy rolls filled with fresh vegetables",
      price:         180,
      comparePrice:  220,
      categoryId:    categoryIds["Starters"],
      isVeg:         true,
      isRecommended: false,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    1,
      rating:        4.2,
      reviewCount:   89,
      prepTime:      10,
      calories:      210,
      image:         "",
    },
    {
      name:          "Chicken Tikka",
      description:   "Tender chicken pieces grilled in tandoor",
      price:         320,
      comparePrice:  400,
      categoryId:    categoryIds["Starters"],
      isVeg:         false,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    true,
      isTodaySpecial: false,
      spiceLevel:    3,
      rating:        4.7,
      reviewCount:   215,
      prepTime:      20,
      calories:      380,
      image:         "",
    },

    // Main Course
    {
      name:          "Butter Chicken",
      description:   "Creamy tomato-based chicken curry",
      price:         380,
      comparePrice:  450,
      categoryId:    categoryIds["Main Course"],
      isVeg:         false,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    true,
      isTodaySpecial: true,
      spiceLevel:    2,
      rating:        4.8,
      reviewCount:   342,
      prepTime:      25,
      calories:      520,
      image:         "",
    },
    {
      name:          "Paneer Butter Masala",
      description:   "Cottage cheese in rich buttery tomato gravy",
      price:         320,
      comparePrice:  380,
      categoryId:    categoryIds["Main Course"],
      isVeg:         true,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: true,
      spiceLevel:    2,
      rating:        4.6,
      reviewCount:   198,
      prepTime:      20,
      calories:      480,
      image:         "",
    },
    {
      name:          "Dal Makhani",
      description:   "Slow cooked black lentils in cream and butter",
      price:         260,
      comparePrice:  300,
      categoryId:    categoryIds["Main Course"],
      isVeg:         true,
      isRecommended: false,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    1,
      rating:        4.4,
      reviewCount:   156,
      prepTime:      15,
      calories:      420,
      image:         "",
    },

    // Breads
    {
      name:          "Butter Naan",
      description:   "Soft leavened bread baked in tandoor",
      price:         60,
      comparePrice:  null,
      categoryId:    categoryIds["Breads"],
      isVeg:         true,
      isRecommended: false,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    0,
      rating:        4.3,
      reviewCount:   445,
      prepTime:      8,
      calories:      180,
      image:         "",
    },
    {
      name:          "Garlic Naan",
      description:   "Naan topped with garlic and butter",
      price:         80,
      comparePrice:  null,
      categoryId:    categoryIds["Breads"],
      isVeg:         true,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    0,
      rating:        4.5,
      reviewCount:   312,
      prepTime:      8,
      calories:      200,
      image:         "",
    },

    // Rice & Biryani
    {
      name:          "Veg Biryani",
      description:   "Fragrant basmati rice with mixed vegetables",
      price:         280,
      comparePrice:  320,
      categoryId:    categoryIds["Rice & Biryani"],
      isVeg:         true,
      isRecommended: false,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    2,
      rating:        4.3,
      reviewCount:   167,
      prepTime:      30,
      calories:      560,
      image:         "",
    },
    {
      name:          "Chicken Biryani",
      description:   "Aromatic rice cooked with tender chicken pieces",
      price:         360,
      comparePrice:  420,
      categoryId:    categoryIds["Rice & Biryani"],
      isVeg:         false,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    true,
      isTodaySpecial: true,
      spiceLevel:    3,
      rating:        4.9,
      reviewCount:   523,
      prepTime:      35,
      calories:      680,
      image:         "",
    },

    // Desserts
    {
      name:          "Gulab Jamun",
      description:   "Soft milk dumplings in rose sugar syrup",
      price:         120,
      comparePrice:  null,
      categoryId:    categoryIds["Desserts"],
      isVeg:         true,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    0,
      rating:        4.7,
      reviewCount:   289,
      prepTime:      5,
      calories:      320,
      image:         "",
    },
    {
      name:          "Kulfi",
      description:   "Traditional Indian ice cream with pistachios",
      price:         140,
      comparePrice:  160,
      categoryId:    categoryIds["Desserts"],
      isVeg:         true,
      isRecommended: false,
      isPopular:     false,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    0,
      rating:        4.4,
      reviewCount:   134,
      prepTime:      5,
      calories:      280,
      image:         "",
    },

    // Drinks
    {
      name:          "Mango Lassi",
      description:   "Chilled mango yogurt drink",
      price:         120,
      comparePrice:  null,
      categoryId:    categoryIds["Drinks"],
      isVeg:         true,
      isRecommended: true,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    0,
      rating:        4.6,
      reviewCount:   201,
      prepTime:      5,
      calories:      180,
      image:         "",
    },
    {
      name:          "Fresh Lime Soda",
      description:   "Refreshing lime with soda water",
      price:         80,
      comparePrice:  null,
      categoryId:    categoryIds["Drinks"],
      isVeg:         true,
      isRecommended: false,
      isPopular:     true,
      isFeatured:    false,
      isTodaySpecial: false,
      spiceLevel:    0,
      rating:        4.2,
      reviewCount:   98,
      prepTime:      3,
      calories:      60,
      image:         "",
    },
  ];

  for (const product of products) {
    await db.collection("products").add({
      ...product,
      restaurantId: RESTAURANT_ID,
      isAvailable:  true,
      sortOrder:    0,
    });
    console.log(`✅ Product: ${product.name}`);
  }

  // ── Offers ──────────────────────────────────────────────────────────────
  await db.collection("offers").add({
    restaurantId:  RESTAURANT_ID,
    title:         "Welcome Offer",
    description:   "Get 20% off on your first order",
    discountValue: 20,
    code:          "WELCOME20",
    isActive:      true,
  });

  await db.collection("offers").add({
    restaurantId:  RESTAURANT_ID,
    title:         "Happy Hours",
    description:   "Flat 15% off between 3PM - 6PM",
    discountValue: 15,
    code:          "HAPPY15",
    isActive:      true,
  });

  console.log("✅ Offers created");
  console.log("\n🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});