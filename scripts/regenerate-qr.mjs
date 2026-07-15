// scripts/regenerate-qr.mjs
const BASE_URL = "https://online-orderingsystem.vercel.app";
const API_URL  = `${BASE_URL}/api/admin/tables`;

async function regenerateAll() {
  console.log("📋 Fetching all tables...");

  const res = await fetch(API_URL);
  
  // ✅ Pehle text dekho, phir JSON parse karo
  const text = await res.text();
  console.log("Raw response:", text.substring(0, 200));

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.error("❌ JSON parse failed - deployment shayad complete nahi hui");
    console.error("Response:", text.substring(0, 500));
    return;
  }

  const tables = data.tables || [];
  console.log(`✅ Found ${tables.length} tables\n`);

  if (tables.length === 0) {
    console.log("⚠️ Koi table nahi mila!");
    return;
  }

  for (const table of tables) {
    process.stdout.write(`🔄 Table ${table.number} (${table.id})... `);

    const patchRes = await fetch(API_URL, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: table.id }),
    });

    const patchText = await patchRes.text();

    if (patchRes.ok) {
      console.log("✅ Done!");
    } else {
      console.log("❌ Failed:", patchText.substring(0, 200));
    }
  }

  console.log("\n🎉 Sab tables ka QR regenerate ho gaya!");
}

regenerateAll().catch(console.error);