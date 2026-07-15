// src/app/orders/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion }                            from "framer-motion";
import { ArrowLeft, ShoppingBag, RefreshCw } from "lucide-react";
import Link                                  from "next/link";
import { formatCurrency, formatDate }        from "@/lib/utils";
import { Skeleton }                          from "@/components/ui/skeleton";
import type { Order, OrderItem }             from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

const POLL_INTERVAL_MS = 15_000;

// ─── Status Config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "Pending",   color: "text-amber-700",   bg: "bg-amber-100"  },
  preparing: { label: "Preparing", color: "text-blue-700",    bg: "bg-blue-100"   },
  ready:     { label: "Ready",     color: "text-green-700",   bg: "bg-green-100"  },
  served:    { label: "Served",    color: "text-emerald-700", bg: "bg-emerald-100" },
  completed: { label: "Completed", color: "text-slate-700",   bg: "bg-slate-100"  },
  cancelled: { label: "Cancelled", color: "text-red-700",     bg: "bg-red-100"    },
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function CustomerOrdersPage() {
  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // ── Resolve authenticated user ────────────────────────────────────────────
  // Uses verify-status which reads from Firestore — no localStorage fallback.
  // customerId (UID) is the canonical identifier for fetching orders.

  const resolveUser = useCallback(async () => {
    try {
      const res  = await fetch("/api/auth/verify-status", { cache: "no-store" });
      const data = await res.json() as {
        authenticated: boolean;
        user?: { uid: string };
      };

      if (data.authenticated && data.user?.uid) {
        setCustomerId(data.user.uid);
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
        setLoading(false);
      }
    } catch {
      setIsLoggedIn(false);
      setLoading(false);
    }
  }, []);

  // ── Fetch orders by customerId ────────────────────────────────────────────
  // Server-side filter — not client-side filtering of all orders.

  const fetchOrders = useCallback(async (uid: string, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res  = await fetch(
        `/api/orders?customerId=${uid}&restaurantId=${RESTAURANT_ID}`,
        { cache: "no-store" }
      );
      const data = await res.json() as { orders?: Order[] };
      setOrders(data.orders ?? []);
    } catch (err) {
      console.error("Fetch orders error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    resolveUser();
  }, [resolveUser]);

  useEffect(() => {
    if (!customerId) return;

    fetchOrders(customerId);

    const interval = setInterval(() => {
      fetchOrders(customerId, true);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [customerId, fetchOrders]);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] p-4 pb-24">
        <div className="max-w-lg mx-auto space-y-4 pt-4">
          <Skeleton className="h-8 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] pb-24">

      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/menu"
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-base font-bold text-slate-900">My Orders</h1>
          </div>

          {isLoggedIn && customerId && (
            <button
              onClick={() => fetchOrders(customerId, true)}
              disabled={refreshing}
              className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">

        {/* Not Logged In */}
        {!isLoggedIn && (
          <div className="flex flex-col items-center justify-center py-16">
            <ShoppingBag className="w-16 h-16 text-slate-200 mb-4" />
            <h2 className="text-lg font-semibold text-slate-500">Please Login First</h2>
            <p className="text-sm text-slate-400 mt-1 text-center">
              Login to view your current and past orders
            </p>
            <Link
              href="/login?redirect=/orders"
              className="mt-6 h-12 px-6 bg-orange-500 text-white font-semibold rounded-xl flex items-center gap-2"
            >
              Login
            </Link>
          </div>
        )}

        {/* No Orders */}
        {isLoggedIn && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16">
            <ShoppingBag className="w-16 h-16 text-slate-200 mb-4" />
            <h2 className="text-lg font-semibold text-slate-500">No Orders Yet</h2>
            <p className="text-sm text-slate-400 mt-1 text-center">
              Your order history will appear here
            </p>
            <Link
              href="/menu"
              className="mt-6 h-12 px-6 bg-orange-500 text-white font-semibold rounded-xl flex items-center gap-2"
            >
              Browse Menu
            </Link>
          </div>
        )}

        {/* Order Cards */}
        {isLoggedIn && orders.map((order, idx) => {
          const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
          const cfg   = statusConfig[order.status ?? "pending"] ?? statusConfig.pending;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                href={`/orders/${order.id}`}
                className="block bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-900">{order.orderNumber}</h3>
                  <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-2">{formatDate(order.createdAt)}</p>

                <div className="text-xs text-slate-500 line-clamp-1 mb-3">
                  {items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(order.total)}
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    order.paymentStatus === "paid"
                      ? "bg-green-100 text-green-700"
                      : "bg-amber-100 text-amber-700"
                  }`}>
                    {order.paymentStatus === "paid" ? "PAID" : "UNPAID"}
                  </span>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}