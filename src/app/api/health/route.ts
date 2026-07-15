// src/app/api/health/route.ts
//
// Health check endpoint.
// Verifies server is running AND Firestore is reachable.
// Used by uptime monitors, load balancers, and deployment checks.

import { db, doc, getDoc } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET() {
  const start = Date.now();

  try {
    // Ping Firestore with a lightweight read on a non-existent document.
    // This verifies the Admin SDK is initialized and Firestore is reachable
    // without reading any real data or incurring meaningful cost.
    await getDoc(doc(db, "_health", "ping"));

    const latencyMs = Date.now() - start;

    return Response.json({
      ok:         true,
      status:     "healthy",
      latencyMs,
      timestamp:  new Date().toISOString(),
      services: {
        firestore: "ok",
      },
    });

  } catch (error) {
    const latencyMs = Date.now() - start;
    console.error("Health check failed:", error);

    return Response.json(
      {
        ok:        false,
        status:    "unhealthy",
        latencyMs,
        timestamp: new Date().toISOString(),
        services: {
          firestore: "error",
        },
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}