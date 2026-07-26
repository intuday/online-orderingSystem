// src/components/ImageUploader.tsx
//
// Reusable image uploader with 2 tabs:
// - Upload: File upload from device gallery
// - URL: Paste external image URL
//
// Handles both flows and returns final URL via onChange callback.

"use client";

import { useState, useRef, type ChangeEvent } from "react";
import {
  Upload, Link as LinkIcon, X,
  Loader2, ImageIcon, Check,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = "image/jpeg,image/jpg,image/png,image/webp,image/gif";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageUploaderProps {
  /** Current image URL (either uploaded or external) */
  value?: string;

  /** Called when image changes — receives new URL or empty string */
  onChange: (url: string) => void;

  /** Cloudinary folder — "menu" or "offers" */
  folder?: "menu" | "offers";

  /** Optional label above the uploader */
  label?: string;

  /** Optional help text */
  helpText?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageUploader({
  value    = "",
  onChange,
  folder   = "menu",
  label,
  helpText,
}: ImageUploaderProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "url">("upload");
  const [urlInput, setUrlInput]   = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const fileInputRef              = useRef<HTMLInputElement>(null);

  // ── File → base64 conversion ──────────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

  // ── Handle file upload ────────────────────────────────────────────────────
  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    // Client-side validation
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`Image too large. Max ${MAX_FILE_SIZE / 1024 / 1024} MB allowed.`);
      return;
    }

    setUploading(true);

    try {
      const base64 = await fileToBase64(file);

      const res = await fetch("/api/admin/upload", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ image: base64, folder }),
      });

      const data = await res.json() as { success?: boolean; url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error ?? "Upload failed. Please try again.");
        return;
      }

      onChange(data.url);
    } catch (err) {
      console.error("Upload error:", err);
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Handle URL apply ──────────────────────────────────────────────────────
  const handleUrlApply = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;

    // Basic URL validation
    try {
      new URL(trimmed);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setError("");
    onChange(trimmed);
    setUrlInput("");
  };

  // ── Handle remove ─────────────────────────────────────────────────────────
  const handleRemove = async () => {
    // If it's a Cloudinary URL, delete from server too
    if (value.includes("cloudinary.com")) {
      try {
        await fetch(`/api/admin/upload?url=${encodeURIComponent(value)}`, {
          method: "DELETE",
        });
      } catch {
        // Non-critical — even if delete fails, remove from UI
      }
    }

    onChange("");
    setError("");
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-semibold text-slate-700">
          {label}
        </label>
      )}

      {/* Current Image Preview */}
      {value && (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Preview"
            className="w-full h-40 object-cover"
            onError={() => setError("Failed to load image")}
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
          >
            <X className="w-4 h-4" />
          </button>
          {value.includes("cloudinary.com") && (
            <div className="absolute bottom-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" />
              Uploaded
            </div>
          )}
        </div>
      )}

      {/* Tabs — only show if no image yet */}
      {!value && (
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          {/* Tab buttons */}
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => { setActiveTab("upload"); setError(""); }}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "upload"
                  ? "bg-orange-50 text-orange-600 border-b-2 border-orange-500"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab("url"); setError(""); }}
              className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "url"
                  ? "bg-orange-50 text-orange-600 border-b-2 border-orange-500"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              URL
            </button>
          </div>

          {/* Tab content */}
          <div className="p-4">
            {activeTab === "upload" && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="hidden"
                  id={`file-upload-${folder}`}
                />
                <label
                  htmlFor={`file-upload-${folder}`}
                  className={`flex flex-col items-center justify-center py-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    uploading
                      ? "border-orange-300 bg-orange-50 cursor-wait"
                      : "border-slate-300 hover:border-orange-400 hover:bg-orange-50/40"
                  }`}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-2" />
                      <span className="text-sm font-semibold text-slate-700">Uploading...</span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-2">
                        <ImageIcon className="w-6 h-6 text-orange-500" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        Click to upload
                      </span>
                      <span className="text-xs text-slate-400 mt-1">
                        JPEG, PNG, WebP up to 5 MB
                      </span>
                    </>
                  )}
                </label>
              </div>
            )}

            {activeTab === "url" && (
              <div className="space-y-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => { setUrlInput(e.target.value); setError(""); }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400"
                />
                <button
                  type="button"
                  onClick={handleUrlApply}
                  disabled={!urlInput.trim()}
                  className="w-full h-10 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Use This URL
                </button>
                <p className="text-[10px] text-slate-400 text-center">
                  Paste image URL from any website
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Help text */}
      {helpText && !error && (
        <p className="text-[11px] text-slate-500">{helpText}</p>
      )}
    </div>
  );
}