// src/app/error.tsx
//
// Page-level error boundary.
// Catches runtime errors in any route segment.
// Provides a graceful fallback UI with retry option.

"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console for development
    // In production, this could send to Sentry / LogRocket
    console.error("[Error Boundary]:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div
          className="bg-white rounded-2xl p-8 text-center"
          style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
        >
          {/* Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          {/* Message */}
          <h1 className="text-lg font-black text-slate-900 mb-2">
            Something went wrong
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            We hit an unexpected issue. Please try again or return to the home page.
          </p>

          {/* Error digest for debugging (only visible in dev / when digest exists) */}
          {error.digest && (
            <p className="text-[10px] font-mono text-slate-400 mb-6 bg-slate-50 rounded-lg py-2 px-3">
              Error ID: {error.digest}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={reset}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>

            <a
              href="/menu"
              className="w-full h-12 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              <Home className="w-4 h-4" />
              Go to Menu
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          If the issue persists, please contact support.
        </p>
      </div>
    </div>
  );
}