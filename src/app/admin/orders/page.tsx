// src/app/admin/orders/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }          from "framer-motion";
import {
  ShoppingBag, Clock, ChefHat, Check, X,
  Printer, FileText, Search, Phone,
  CreditCard, Banknote, RefreshCw, Bell,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton }                   from "@/components/ui/skeleton";
import { Button }                     from "@/components/ui/button";
import type { Order, OrderItem, PaymentMode } from "@/lib/types";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { key: "all",       label: "All" },
  { key: "pending",   label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready",     label: "Ready" },
  { key: "served",    label: "Served" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: typeof Clock }> = {
  pending:   { color: "text-amber-700",   bg: "bg-amber-100",   icon: Clock },
  preparing: { color: "text-blue-700",    bg: "bg-blue-100",    icon: ChefHat },
  ready:     { color: "text-green-700",   bg: "bg-green-100",   icon: Check },
  served:    { color: "text-emerald-700", bg: "bg-emerald-100", icon: Check },
  completed: { color: "text-slate-700",   bg: "bg-slate-100",   icon: Check },
  cancelled: { color: "text-red-700",     bg: "bg-red-100",     icon: X },
};

const NEXT_STATUS: Record<string, string> = {
  pending:   "preparing",
  preparing: "ready",
  ready:     "served",
  served:    "completed",
};

const STATUS_LABEL: Record<string, string> = {
  preparing: "Start Preparing",
  ready:     "Mark Ready",
  served:    "Mark Served",
  completed: "Complete Order",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PAYMENT_MODES: PaymentMode[] = ["cash", "card", "upi", "online"];

function toPaymentMode(value: string): PaymentMode {
  return VALID_PAYMENT_MODES.includes(value as PaymentMode)
    ? (value as PaymentMode)
    : "cash";
}

function getTableLabel(order: Order): string {
  if (order.tableName)   return order.tableName;
  if (order.tableNumber) return `Table ${order.tableNumber}`;
  if (order.tableId)     return `Table ${order.tableId}`;
  return "Counter";
}

function parseItems(items: unknown): OrderItem[] {
  if (Array.isArray(items)) return items as OrderItem[];
  if (typeof items === "string") {
    try { return JSON.parse(items); } catch { return []; }
  }
  return [];
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OrdersPage() {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeTab, setActiveTab]         = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [lastRefresh, setLastRefresh]     = useState(new Date());

  const fetchOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res  = await fetch("/api/orders?restaurantId=a0000000-0000-0000-0000-000000000001");
      const data = await res.json();
      setOrders(data.orders || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch orders:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status: newStatus }),
    });
    fetchOrders(true);
    setSelectedOrder((prev) =>
      prev?.id === orderId
        ? { ...prev, status: newStatus as Order["status"] }
        : prev
    );
  };

  const markPaid = async (orderId: string, mode = "cash") => {
    const safeMode = toPaymentMode(mode);
    await fetch(`/api/orders/${orderId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ paymentStatus: "paid", paymentMode: safeMode }),
    });
    fetchOrders(true);
    setSelectedOrder((prev) =>
      prev?.id === orderId
        ? { ...prev, paymentStatus: "paid", paymentMode: safeMode }
        : prev
    );
  };

  const printKOT = (order: Order) => {
    const items   = parseItems(order.items);
    const content = `
      <html><head><title>KOT - ${order.orderNumber}</title>
      <style>
        body { font-family: monospace; width: 280px; padding: 10px; }
        h2 { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
        .item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .qty { font-weight: bold; margin-right: 8px; }
        .note { font-size: 11px; color: #666; padding-left: 20px; font-style: italic; }
        .footer { border-top: 2px dashed #000; padding-top: 8px; text-align: center; font-size: 11px; margin-top: 8px; }
        hr { border: 1px dashed #000; }
      </style></head>
      <body>
        <h2>🍽️ KITCHEN ORDER</h2>
        <p><strong>Order:</strong> ${order.orderNumber}</p>
        <p><strong>Table:</strong> ${getTableLabel(order)}</p>
        <p><strong>Customer:</strong> ${order.customerName || "Guest"}</p>
        <p><strong>Time:</strong> ${formatDate(order.createdAt)}</p>
        <hr/>
        ${items.map((i) => `
          <div class="item">
            <span><span class="qty">${i.quantity}x</span>${i.name}${i.variant ? ` (${i.variant})` : ""}</span>
          </div>
          ${i.addons?.length ? `<div class="note">+ ${i.addons.map((a) => a.name).join(", ")}</div>` : ""}
          ${i.specialInstructions ? `<div class="note">📝 ${i.specialInstructions}</div>` : ""}
        `).join("")}
        ${order.notes ? `<hr/><p style="font-size:11px"><strong>Notes:</strong> ${order.notes}</p>` : ""}
        <div class="footer">*** KOT - ${new Date().toLocaleTimeString()} ***</div>
      </body></html>`;
    const w = window.open("", "_blank", "width=320,height=600");
    if (w) { w.document.write(content); w.document.close(); w.print(); }
  };

  const printInvoice = (order: Order) => {
    const items = parseItems(order.items);
    const cgst  = order.cgst ?? 0;
    const sgst  = order.sgst ?? 0;
    const content = `
      <html><head><title>Invoice - ${order.orderNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; width: 320px; padding: 15px; font-size: 12px; }
        h2 { text-align: center; margin: 0 0 4px; font-size: 18px; }
        .center { text-align: center; }
        .divider { border-top: 1px dashed #999; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th { text-align: left; padding: 3px 2px; font-size: 10px; color: #666; border-bottom: 1px solid #eee; }
        td { padding: 4px 2px; font-size: 11px; border-bottom: 1px solid #f5f5f5; }
        .row { display: flex; justify-content: space-between; padding: 2px 0; }
        .total { font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 4px; margin-top: 4px; }
        .paid { color: green; font-weight: bold; text-align: center; font-size: 14px; }
        .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #666; }
      </style></head>
      <body>
        <div class="center">
          <h2>🍽️ Spice Garden</h2>
          <p style="margin:2px;font-size:10px;color:#666">Tax Invoice</p>
        </div>
        <div class="divider"></div>
        <div class="row"><span><strong>${order.orderNumber}</strong></span><span>${formatDate(order.createdAt)}</span></div>
        <div class="row"><span>Customer: ${order.customerName || "Guest"}</span></div>
        <div class="row"><span>Phone: ${order.customerPhone || "—"}</span></div>
        ${order.tableId ? `<div class="row"><span>Table: ${getTableLabel(order)}</span></div>` : ""}
        <div class="divider"></div>
        <table>
          <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amt</th></tr></thead>
          <tbody>
            ${items.map((i) => `
              <tr>
                <td>${i.name}${i.variant ? ` (${i.variant})` : ""}</td>
                <td>${i.quantity}</td>
                <td>₹${i.price}</td>
                <td>₹${i.price * i.quantity}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="divider"></div>
        <div class="row"><span>Subtotal</span><span>₹${order.subtotal}</span></div>
        ${(order.discount ?? 0) > 0 ? `<div class="row" style="color:green"><span>Discount${order.couponCode ? ` (${order.couponCode})` : ""}</span><span>-₹${order.discount}</span></div>` : ""}
        <div class="row" style="color:#666;font-size:10px"><span>CGST (2.5%)</span><span>₹${cgst}</span></div>
        <div class="row" style="color:#666;font-size:10px"><span>SGST (2.5%)</span><span>₹${sgst}</span></div>
        ${(order.tip ?? 0) > 0 ? `<div class="row"><span>Tip</span><span>₹${order.tip}</span></div>` : ""}
        <div class="row total"><span>Total</span><span>₹${order.total}</span></div>
        <div class="divider"></div>
        <p class="paid">${order.paymentStatus === "paid"
          ? `✅ PAID (${order.paymentMode || "Counter"})`
          : "⏳ PAYMENT PENDING"}</p>
        <div class="footer">
          <p>Thank you for dining with us!</p>
          <p>Visit again 🙏</p>
        </div>
      </body></html>`;
    const w = window.open("", "_blank", "width=360,height=700");
    if (w) { w.document.write(content); w.document.close(); w.print(); }
  };

  const pendingPayments = orders.filter(
    (o) => o.paymentStatus !== "paid" && o.status !== "cancelled"
  ).length;

  const filtered = orders.filter((o) => {
    const matchStatus = activeTab === "all" || o.status === activeTab;
    const matchSearch = !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.customerPhone || "").includes(searchQuery);
    return matchStatus && matchSearch;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-slate-500">{orders.length} total orders</p>
            {pendingPayments > 0 && (
              <span className="flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                <Bell className="w-3 h-3" />
                {pendingPayments} unpaid
              </span>
            )}
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastRefresh.toLocaleTimeString("en-IN", {
                hour:   "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search orders, name, phone..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
        {STATUS_TABS.map((tab) => {
          const count = tab.key === "all"
            ? orders.length
            : orders.filter((o) => o.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                activeTab === tab.key
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((order) => {
          const items  = parseItems(order.items);
          const cfg    = STATUS_CONFIG[order.status ?? "pending"] ?? STATUS_CONFIG.pending;
          const isPaid = order.paymentStatus === "paid";

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setSelectedOrder(order)}
              className="bg-white rounded-2xl p-4 shadow-card cursor-pointer hover:shadow-elevated transition-all border border-transparent hover:border-orange-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 font-mono">{order.orderNumber}</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${cfg.bg} ${cfg.color}`}>
                    {order.status}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isPaid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}>
                    {isPaid ? "✓ PAID" : "UNPAID"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-[10px] font-bold shrink-0">
                  {(order.customerName || "G").charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-slate-600 font-medium line-clamp-1">
                  {order.customerName || "Guest"}
                </span>
                {order.customerPhone && (
                  <span className="text-[10px] text-slate-400">• {order.customerPhone}</span>
                )}
              </div>

              <p className="text-xs text-slate-400 line-clamp-1 mb-3">
                {items.map((i) => `${i.quantity}× ${i.name}`).join(" • ")}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <span className="text-base font-bold text-slate-900">{formatCurrency(order.total)}</span>
                <div className="flex items-center gap-2">
                  {order.tableId && (
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
                      {getTableLabel(order)}
                    </span>
                  )}
                  {!isPaid && order.status !== "cancelled" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markPaid(order.id);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors active:scale-95"
                    >
                      Mark Paid
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <ShoppingBag className="w-12 h-12 text-slate-200 mb-4" />
          <h3 className="text-base font-semibold text-slate-500">No orders found</h3>
          <p className="text-sm text-slate-400 mt-1">Orders appear here when customers place them</p>
        </div>
      )}

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onStatusUpdate={updateOrderStatus}
            onMarkPaid={markPaid}
            onPrintKOT={printKOT}
            onPrintInvoice={printInvoice}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Order Detail Modal ───────────────────────────────────────────────────────

function OrderDetailModal({
  order, onClose, onStatusUpdate, onMarkPaid, onPrintKOT, onPrintInvoice,
}: {
  order:          Order;
  onClose:        () => void;
  onStatusUpdate: (id: string, status: string) => void;
  onMarkPaid:     (id: string, mode?: string) => void;
  onPrintKOT:     (order: Order) => void;
  onPrintInvoice: (order: Order) => void;
}) {
  const items      = parseItems(order.items);
  const isPaid     = order.paymentStatus === "paid";
  const nextStatus = NEXT_STATUS[order.status ?? ""];
  const statusCfg  = STATUS_CONFIG[order.status ?? "pending"] ?? STATUS_CONFIG.pending;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between shrink-0 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 font-mono">{order.orderNumber}</h2>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${statusCfg.bg} ${statusCfg.color}`}>
                {order.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">

          {/* Payment Status */}
          <div className={`rounded-2xl p-4 flex items-center justify-between ${
            isPaid
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isPaid ? "bg-green-100" : "bg-red-100"
              }`}>
                {isPaid
                  ? <Check className="w-5 h-5 text-green-600" />
                  : <CreditCard className="w-5 h-5 text-red-500" />}
              </div>
              <div>
                <p className={`text-sm font-bold ${isPaid ? "text-green-700" : "text-red-700"}`}>
                  {isPaid ? "Payment Received ✅" : "Payment Pending ⏳"}
                </p>
                <p className="text-xs text-slate-500">
                  {isPaid
                    ? `Paid via ${order.paymentMode || "Counter"}`
                    : `Total: ${formatCurrency(order.total)}`}
                </p>
              </div>
            </div>
            {!isPaid && order.status !== "cancelled" && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => onMarkPaid(order.id, "cash")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-xl hover:bg-green-600 transition-colors active:scale-95"
                >
                  <Banknote className="w-3.5 h-3.5" /> Cash
                </button>
                <button
                  onClick={() => onMarkPaid(order.id, "upi")}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white text-xs font-bold rounded-xl hover:bg-blue-600 transition-colors active:scale-95"
                >
                  <CreditCard className="w-3.5 h-3.5" /> UPI
                </button>
              </div>
            )}
          </div>

          {/* Customer Info */}
          <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white font-bold shrink-0">
              {(order.customerName || "G").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">{order.customerName || "Guest"}</p>
              {order.customerPhone && (
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {order.customerPhone}
                </p>
              )}
            </div>
            {order.tableId && (
              <div className="text-right">
                <p className="text-[10px] text-slate-400">Table</p>
                <p className="text-sm font-bold text-slate-900">{getTableLabel(order)}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              Order Items ({items.length})
            </h3>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start bg-slate-50 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      <span className="text-orange-500 font-bold">{item.quantity}×</span>{" "}
                      {item.name}
                    </p>
                    {item.variant && (
                      <p className="text-xs text-slate-500 mt-0.5">{item.variant}</p>
                    )}
                    {item.addons && item.addons.length > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        + {item.addons.map((a) => a.name).join(", ")}
                      </p>
                    )}
                    {item.specialInstructions && (
                      <p className="text-[10px] text-amber-600 mt-1 bg-amber-50 rounded-lg px-2 py-0.5">
                        📝 {item.specialInstructions}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-900 ml-3 shrink-0">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs font-bold text-amber-700 mb-1">📝 Customer Notes</p>
              <p className="text-sm text-amber-800">{order.notes}</p>
            </div>
          )}

          {/* Bill Summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Bill Summary
            </h3>
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {(order.discount ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  Discount
                  {order.couponCode && (
                    <span className="ml-1 text-[10px] bg-green-100 px-1.5 py-0.5 rounded-full">
                      {order.couponCode}
                    </span>
                  )}
                </span>
                <span>-{formatCurrency(order.discount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-400">
              <span>CGST (2.5%)</span>
              <span>{formatCurrency(order.cgst ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>SGST (2.5%)</span>
              <span>{formatCurrency(order.sgst ?? 0)}</span>
            </div>
            {(order.tip ?? 0) > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Tip 💝</span>
                <span>{formatCurrency(order.tip ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-900 text-base pt-2 border-t border-dashed border-slate-300">
              <span>Total</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => onPrintKOT(order)}>
                <Printer className="w-4 h-4 mr-1" /> Print KOT
              </Button>
              <Button variant="outline" size="sm" onClick={() => onPrintInvoice(order)}>
                <FileText className="w-4 h-4 mr-1" /> Invoice
              </Button>
            </div>

            {nextStatus && order.status !== "cancelled" && (
              <button
                onClick={() => onStatusUpdate(order.id, nextStatus)}
                className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 active:scale-[0.98] transition-all"
              >
                {nextStatus === "preparing" && <ChefHat className="w-4 h-4" />}
                {nextStatus === "ready"     && <Check   className="w-4 h-4" />}
                {nextStatus === "served"    && <Check   className="w-4 h-4" />}
                {nextStatus === "completed" && <Check   className="w-4 h-4" />}
                {STATUS_LABEL[nextStatus]}
              </button>
            )}

            {order.status !== "cancelled" && order.status !== "completed" && (
              <button
                onClick={() => onStatusUpdate(order.id, "cancelled")}
                className="w-full py-2.5 bg-red-50 text-red-600 font-semibold rounded-xl text-sm hover:bg-red-100 active:scale-[0.98] transition-all border border-red-200"
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}