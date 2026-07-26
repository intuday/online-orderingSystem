// src/app/api/admin/upload/route.ts
//
// Image upload endpoint for admin panel.
// Accepts base64 image, uploads to Cloudinary, returns secure URL.
//
// Security:
// - Admin auth required
// - File size limit (5 MB)
// - Only image mime types allowed
// - Server-side upload — API secret never exposed to client

import { NextRequest }        from "next/server";
import { verifyAdmin }        from "@/lib/auth/server-auth";
import { uploadImage, deleteImage } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// ─── Constants ────────────────────────────────────────────────────────────────

// Base64-encoded 5 MB image is ~7 MB in payload
const MAX_PAYLOAD_SIZE = 7 * 1024 * 1024; // 7 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_FOLDERS = new Set(["menu", "offers"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Validates a base64 data URL and extracts the mime type.
 * Returns null if invalid.
 */
function validateBase64Image(dataUrl: string): { mimeType: string; size: number } | null {
  // Format: data:image/jpeg;base64,/9j/4AAQSkZJRgAB...
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1];
  const base64   = match[2];

  if (!ALLOWED_MIME_TYPES.has(mimeType)) return null;

  // Approximate file size from base64 length
  // Base64 is ~1.33x larger than binary
  const size = Math.floor((base64.length * 3) / 4);

  return { mimeType, size };
}

// ─── POST /api/admin/upload ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // ── Authentication ──────────────────────────────────────────────────────
    const admin = await verifyAdmin(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Payload size check ──────────────────────────────────────────────────
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAYLOAD_SIZE) {
      return Response.json(
        { error: "Image too large. Max 5 MB allowed." },
        { status: 413 }
      );
    }

    // ── Parse body ──────────────────────────────────────────────────────────
    const body = await request.json() as {
      image?:  string;
      folder?: string;
    };

    const image  = typeof body.image  === "string" ? body.image  : "";
    const folder = typeof body.folder === "string" ? body.folder : "menu";

    if (!image) {
      return Response.json({ error: "No image provided" }, { status: 400 });
    }

    if (!ALLOWED_FOLDERS.has(folder)) {
      return Response.json(
        { error: `Invalid folder. Allowed: ${Array.from(ALLOWED_FOLDERS).join(", ")}` },
        { status: 400 }
      );
    }

    // ── Validate image ──────────────────────────────────────────────────────
    const validation = validateBase64Image(image);
    if (!validation) {
      return Response.json(
        { error: "Invalid image format. Supported: JPEG, PNG, WebP, GIF." },
        { status: 400 }
      );
    }

    // Check actual decoded size
    if (validation.size > 5 * 1024 * 1024) {
      return Response.json(
        { error: "Image too large. Max 5 MB allowed." },
        { status: 413 }
      );
    }

    // ── Upload to Cloudinary ────────────────────────────────────────────────
    const url = await uploadImage(image, {
      folder: folder as "menu" | "offers",
    });

    return Response.json({
      success: true,
      url,
      size:    validation.size,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return Response.json(
      { error: "Failed to upload image. Please try again." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/admin/upload ─────────────────────────────────────────────────
// Delete an image from Cloudinary.
// Called when admin removes an image from menu/offer.

export async function DELETE(request: NextRequest) {
  try {
    const admin = await verifyAdmin(request);
    if (!admin) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return Response.json({ error: "URL required" }, { status: 400 });
    }

    // Only delete Cloudinary URLs (safety check)
    if (!url.includes("cloudinary.com")) {
      return Response.json(
        { error: "Can only delete Cloudinary images" },
        { status: 400 }
      );
    }

    const deleted = await deleteImage(url);

    return Response.json({
      success: deleted,
      message: deleted ? "Image deleted" : "Image not found (may already be removed)",
    });

  } catch (error) {
    console.error("Delete error:", error);
    return Response.json(
      { error: "Failed to delete image" },
      { status: 500 }
    );
  }
}