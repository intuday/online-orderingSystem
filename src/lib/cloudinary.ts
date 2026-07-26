// src/lib/cloudinary.ts
//
// Cloudinary SDK initialization — server-side only.
// Used for uploading and managing images (menu, offers).

import { v2 as cloudinary } from "cloudinary";

// ─── Environment Validation ──────────────────────────────────────────────────

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
  throw new Error(
    "[Cloudinary] Missing required environment variables:\n" +
    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET\n" +
    "Set these in .env.local (dev) and Vercel Environment Variables (production)."
  );
}

// ─── Configure Cloudinary ─────────────────────────────────────────────────────

cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key:    API_KEY,
  api_secret: API_SECRET,
  secure:     true,
});

export { cloudinary };

// ─── Upload Options ───────────────────────────────────────────────────────────

export interface UploadOptions {
  folder?:  "menu" | "offers";
  publicId?: string;
}

/**
 * Uploads a base64 image string to Cloudinary.
 * Returns the secure URL of the uploaded image.
 *
 * Automatic optimizations applied:
 * - Format: auto (WebP for supported browsers)
 * - Quality: auto:good (balance between size and quality)
 * - Max dimensions: 1200x1200 (bigger images auto-resized)
 */
export async function uploadImage(
  base64:  string,
  options: UploadOptions = {}
): Promise<string> {
  const { folder = "menu", publicId } = options;

  const result = await cloudinary.uploader.upload(base64, {
    folder:       `restaurant/${folder}`,
    public_id:    publicId,
    resource_type: "image",
    // Automatic optimizations
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },  // Max 1200x1200
      { quality: "auto:good" },                       // Smart compression
      { fetch_format: "auto" },                       // WebP where supported
    ],
    // Overwrite if same publicId
    overwrite: true,
  });

  return result.secure_url;
}

/**
 * Deletes an image from Cloudinary by its public ID.
 * Extracts public ID from a Cloudinary URL if full URL is provided.
 *
 * Returns true if deleted, false if not found.
 */
export async function deleteImage(urlOrPublicId: string): Promise<boolean> {
  try {
    // Extract public_id from Cloudinary URL if full URL provided
    // Example: https://res.cloudinary.com/xxx/image/upload/v123/restaurant/menu/abc.jpg
    // Public ID: restaurant/menu/abc
    let publicId = urlOrPublicId;

    if (urlOrPublicId.startsWith("http")) {
      const match = urlOrPublicId.match(/\/upload\/(?:v\d+\/)?(.+?)\.\w+$/);
      if (!match) return false;
      publicId = match[1];
    }

    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === "ok";
  } catch (err) {
    console.error("Cloudinary delete error:", err);
    return false;
  }
}