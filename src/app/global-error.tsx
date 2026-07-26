// src/app/global-error.tsx
//
// Root-level error boundary.
// Catches errors in the root layout itself (worst case scenario).
// Must include <html> and <body> tags — replaces the entire layout.

"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{
        margin:         0,
        padding:        0,
        minHeight:      "100vh",
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        backgroundColor: "#F5F5F5",
        fontFamily:     "system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          maxWidth:      "400px",
          width:         "90%",
          backgroundColor: "white",
          borderRadius:  "16px",
          padding:       "32px",
          textAlign:     "center",
          boxShadow:     "0 4px 24px rgba(0,0,0,0.08)",
        }}>
          {/* Icon */}
          <div style={{
            width:          "64px",
            height:         "64px",
            margin:         "0 auto 16px",
            borderRadius:   "16px",
            backgroundColor: "#fef2f2",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       "32px",
          }}>
            ⚠️
          </div>

          {/* Message */}
          <h1 style={{
            fontSize:   "18px",
            fontWeight: "900",
            color:      "#0f172a",
            margin:     "0 0 8px",
          }}>
            Application Error
          </h1>
          <p style={{
            fontSize:   "14px",
            color:      "#64748b",
            margin:     "0 0 24px",
            lineHeight: "1.5",
          }}>
            We hit a critical error. Please refresh the page.
          </p>

          {error.digest && (
            <p style={{
              fontSize:     "10px",
              fontFamily:   "monospace",
              color:        "#94a3b8",
              backgroundColor: "#f8fafc",
              borderRadius: "8px",
              padding:      "8px 12px",
              margin:       "0 0 24px",
            }}>
              Error ID: {error.digest}
            </p>
          )}

          {/* Actions */}
          <button
            onClick={reset}
            style={{
              width:          "100%",
              height:         "48px",
              backgroundColor: "#f97316",
              color:          "white",
              fontWeight:     "700",
              borderRadius:   "12px",
              border:         "none",
              cursor:         "pointer",
              fontSize:       "14px",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}