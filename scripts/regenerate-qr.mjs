// scripts/regenerate-qr.mjs
const BASE_URL = "https://online-orderingsystem.vercel.app";
const API_URL  = `${BASE_URL}/api/admin/tables`;

async function regenerateAll() {
  console.log("📋 Fetching all tables...");

  const res    = await fetch(API_URL);
  const data   = await res.json();
  const tables = data.tables || [];

  console.log(`✅ Found ${tables.length} tables\n`);

  for (const table of tables) {
    process.stdout.write(`🔄 Table ${table.number} (${table.id})... `);

    const patchRes = await fetch(API_URL, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: table.id }),
    });

    if (patchRes.ok) {
      console.log("✅ Done!");
    } else {
      console.log("❌ Failed:", await patchRes.text());
    }
  }

  console.log("\n🎉 Sab tables ka QR regenerate ho gaya!");
  console.log("Ab admin panel pe jao aur naya QR download karo.");
}

regenerateAll().catch(console.error);