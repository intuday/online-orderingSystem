// src/app/orders/[id]/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion }                                     from "framer-motion";
import { useRouter, useParams }                       from "next/navigation";
import {
  ArrowLeft, ChefHat, CheckCircle, Package,
  XCircle, Phone, QrCode, Receipt,
  IndianRupee, RefreshCw,
}                                                     from "lucide-react";
import { formatCurrency }                             from "@/lib/utils";
import type { Order, OrderItem, OrderStatus }         from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 15_000;

// Terminal statuses — stop polling when reached
const TERMINAL_STATUSES: OrderStatus[] = ["completed", "cancelled"];

// ─── Status Steps ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { key: "pending",   label: "Order Placed", icon: Receipt,     desc: "Your order has been received" },
  { key: "preparing", label: "Preparing",    icon: ChefHat,     desc: "Kitchen is cooking your food" },
  { key: "ready",     label: "Ready",        icon: Package,     desc: "Your order is ready!" },
  { key: "served",    label: "Served",       icon: CheckCircle, desc: "Enjoy your meal!" },
  { key: "completed", label: "Completed",    icon: CheckCircle, desc: "Thank you for dining!" },
] as const;

const STATUS_ORDER: OrderStatus[] = [
  "pending", "preparing", "ready", "served", "completed",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractMs(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime();
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    if (typeof v._seconds === "number") return v._seconds * 1000;
    if (typeof v.seconds  === "number") return v.seconds  * 1000;
  }
  return 0;
}

function timeAgo(value: unknown): string {
  const ms = extractMs(value);
  if (!ms) return "";
  const diff  = Date.now() - ms;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  if (mins  <  1) return "Just now";
  if (mins  < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  return new Date(ms).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function OrderTrackingPage() {
  const router  = useRouter();
  const params  = useParams();

  const orderId = useMemo<string>(() => {
    const raw = params?.id;
    const val = Array.isArray(raw) ? raw[0] : raw;
    return val ?? "";
  }, [params]);

  const [order, setOrder]           = useState<Order | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState("");

  const fetchOrder = useCallback(async (silent = false) => {
    if (!orderId) {
      setError("Invalid order ID");
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      setError("");
      const res  = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const data = await res.json() as { order?: Order; error?: string };

      if (!res.ok || !data.order) {
        setError(data.error ?? "Order not found");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Failed to load order. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // ── Smart Polling — stops on terminal statuses ────────────────────────────
  useEffect(() => {
    if (!order) return;

    // Do not poll if order is in a terminal state
    if (TERMINAL_STATUSES.includes(order.status as OrderStatus)) return;

    const interval = setInterval(() => fetchOrder(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [order, fetchOrder]);

  // ── Loading State ─────────────────────────────────────────────────────────

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-slate-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 font-semibold">{error}</p>
          <button
            onClick={() => fetchOrder()}
            className="mt-4 h-10 px-6 bg-orange-500 text-white text-sm font-bold rounded-xl mr-2"
          >
            Retry
          </button>
          <button
            onClick={() => router.push("/menu")}
            className="mt-4 h-10 px-6 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl"
          >
            Menu
          </button>
        </div>
      </div>
    );
  }

  if (!order) return null;

  // ── Derived State ─────────────────────────────────────────────────────────

  const items        = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
  const status       = (order.status ?? "pending") as OrderStatus;
  const isCancelled  = status === "cancelled";
  const currentStep  = isCancelled ? -1 : STATUS_ORDER.indexOf(status);
  const isPaid       = order.paymentStatus === "paid";
  const tableDisplay = order.tableNumber
    ? `Table ${order.tableNumber}`
    : order.tableId
    ? `Table ${order.tableId}`
    : null;

  return (
    <div className="min-h-screen bg-[#fafafa] pb-10">

      {/* Header */}
      <div className={`px-4 pt-12 pb-6 ${isCancelled ? "bg-red-500" : "bg-gradient-to-r from-orange-500 to-red-500"}`}>
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <span className="text-white/80 text-sm font-medium">Order Tracking</span>
            <button
              onClick={() => fetchOrder(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-white ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="text-center">
            <p className="text-white/70 text-sm">Order Number</p>
            <h1 className="text-2xl font-bold text-white font-mono mt-0.5">{order.orderNumber}</h1>
            <p className="text-white/60 text-xs mt-1">{timeAgo(order.createdAt)}</p>
            {tableDisplay && (
              <div className="mt-3 inline-flex items-center gap-2 bg-white/20 text-white text-xs font-bold px-4 py-2 rounded-full border border-white/30">
                <QrCode className="w-3.5 h-3.5" />{tableDisplay}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-3 space-y-4">

        {/* Status Tracker */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {isCancelled ? (
            <div className="p-6 text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
              <h2 className="text-lg font-bold text-slate-900">Order Cancelled</h2>
            </div>
          ) : (
            <div className="p-5">
              <h2 className="text-sm font-bold text-slate-900 mb-4">Order Status</h2>
              {STATUS_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStep;
                const isActive    = idx === currentStep;
                const Icon        = step.icon;
                return (
                  <div key={step.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <motion.div
                        animate={{ scale: isActive ? 1.1 : 1 }}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          isCompleted
                            ? "bg-green-500 text-white"
                            : isActive
                            ? "bg-orange-500 text-white ring-4 ring-orange-100"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </motion.div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div className={`w-0.5 h-8 my-1 rounded-full ${
                          isCompleted ? "bg-green-400" : "bg-slate-200"
                        }`} />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm font-bold ${
                          isActive    ? "text-orange-500"  :
                          isCompleted ? "text-green-600"   :
                          "text-slate-400"
                        }`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <motion.div
                            animate={{ opacity: [1, 0.4, 1] }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                            className="w-2 h-2 bg-orange-500 rounded-full"
                          />
                        )}
                      </div>
                      {(isActive || isCompleted) && (
                        <p className="text-xs text-slate-500 mt-0.5">{step.desc}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment Status */}
          <div className={`px-5 py-3 flex items-center justify-between ${
            isPaid ? "bg-green-50" : "bg-amber-50"
          }`}>
            <div className="flex items-center gap-2">
              <IndianRupee className={`w-4 h-4 ${isPaid ? "text-green-600" : "text-amber-600"}`} />
              <span className={`text-sm font-bold ${isPaid ? "text-green-700" : "text-amber-700"}`}>
                {isPaid ? "Payment Received ✅" : "Payment Pending ⏳"}
              </span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {formatCurrency(order.total ?? 0)}
            </span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
            {(order.customerName || "G").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900">{order.customerName || "Guest"}</p>
            {order.customerPhone && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <Phone className="w-3 h-3" />{order.customerPhone}
              </p>
            )}
          </div>
          {tableDisplay && (
            <div className="shrink-0 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-center">
              <p className="text-[10px] text-orange-500 font-bold uppercase tracking-wide">Table</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">
                {order.tableNumber ?? order.tableId}
              </p>
            </div>
          )}
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-900">
              Order Items ({items.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {items.map((item, idx) => (
              <div key={idx} className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    <span className="text-orange-500 font-bold">{item.quantity}x</span>{" "}
                    {item.name}
                  </p>
                  {item.variant && (
                    <p className="text-xs text-slate-400">{item.variant}</p>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-900 ml-3">
                  {formatCurrency(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-2">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Bill Summary</h3>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(order.subtotal ?? 0)}</span>
          </div>
          {(order.discount ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>
                Discount {order.couponCode ? `(${order.couponCode})` : ""}
              </span>
              <span>-{formatCurrency(order.discount ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-slate-400">
            <span>GST (CGST + SGST)</span>
            <span>{formatCurrency((order.cgst ?? 0) + (order.sgst ?? 0))}</span>
          </div>
          {(order.tip ?? 0) > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tip 💝</span>
              <span>{formatCurrency(order.tip ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-dashed border-slate-200">
            <span>Total</span>
            <span>{formatCurrency(order.total ?? 0)}</span>
          </div>
        </div>

        {/* Notes */}
        {order.notes && order.notes.trim() !== "" && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-700 mb-1">📝 Notes</p>
            <p className="text-sm text-amber-800">{order.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={() => router.push("/menu")}
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-200"
          >
            Back to Menu
          </button>
          <button
            onClick={() => fetchOrder(true)}
            disabled={refreshing || TERMINAL_STATUSES.includes(status)}
            className="w-full h-10 border-2 border-slate-200 text-slate-600 text-sm font-medium rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {TERMINAL_STATUSES.includes(status) ? "Order Finalized" : "Refresh Status"}
          </button>
        </div>
      </div>
    </div>
  );
}