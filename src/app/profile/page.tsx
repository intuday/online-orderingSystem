// src/app/profile/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }          from "framer-motion";
import { useRouter }                        from "next/navigation";
import {
  ArrowLeft, LogOut, ShoppingBag, Clock,
  ChevronRight, Star, Package, CheckCircle,
  XCircle, ChefHat, Sparkles, Phone, Mail,
  IndianRupee, QrCode, Edit2, Save, X,
} from "lucide-react";
import { formatCurrency }   from "@/lib/utils";
import { auth, signOut }    from "@/lib/firebase";
import type { Order, OrderItem } from "@/lib/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESTAURANT_ID =
  process.env.NEXT_PUBLIC_RESTAURANT_ID ??
  "a0000000-0000-0000-0000-000000000001";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  uid:         string;
  name:        string;
  email:       string;
  phone:       string;
  role:        string;
  totalOrders: number;
  totalSpent:  number;
}

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
  if (!ms) return "—";
  const diff  = Date.now() - ms;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return "Just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Status Config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, {
  color: string;
  bg:    string;
  icon:  React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  pending:   { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     icon: Clock,       label: "Pending" },
  preparing: { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",       icon: ChefHat,     label: "Preparing" },
  ready:     { color: "text-green-700",   bg: "bg-green-50 border-green-200",     icon: CheckCircle, label: "Ready" },
  served:    { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: CheckCircle, label: "Served" },
  completed: { color: "text-slate-600",   bg: "bg-slate-50 border-slate-200",     icon: Package,     label: "Completed" },
  cancelled: { color: "text-red-600",     bg: "bg-red-50 border-red-200",         icon: XCircle,     label: "Cancelled" },
};

// ─── Page Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const router = useRouter();

  const [user, setUser]             = useState<UserData | null>(null);
  const [orders, setOrders]         = useState<Order[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [activeTab, setActiveTab]   = useState<"orders" | "info">("orders");

  const [editing, setEditing]     = useState(false);
  const [editName, setEditName]   = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving]       = useState(false);
  const [saveMsg, setSaveMsg]     = useState("");

  const fetchData = useCallback(async () => {
    try {
      const authRes  = await fetch("/api/auth/verify-status");
      const authData = await authRes.json() as {
        authenticated: boolean;
        user?: {
          uid:   string;
          name:  string;
          email: string;
          phone: string;
          role:  string;
        };
      };

      if (!authData.authenticated || !authData.user) {
        router.replace("/login?redirect=/profile");
        return;
      }

      const u = authData.user;
      setUser({
        uid:         u.uid   ?? "",
        name:        u.name  ?? "User",
        email:       u.email ?? "",
        phone:       u.phone ?? "",
        role:        u.role  ?? "customer",
        totalOrders: 0,
        totalSpent:  0,
      });
      setEditName(u.name  ?? "");
      setEditPhone(u.phone ?? "");

      const ordersRes  = await fetch(
        `/api/orders?customerId=${u.uid}&restaurantId=${RESTAURANT_ID}`
      );
      const ordersData = await ordersRes.json() as { orders?: Order[] };
      const myOrders   = ordersData.orders ?? [];
      setOrders(myOrders);

      const totalSpent = myOrders.reduce((s, o) => s + (o.total ?? 0), 0);
      setUser((prev) =>
        prev ? { ...prev, totalOrders: myOrders.length, totalSpent } : prev
      );
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveProfile = async () => {
    if (!user || !editName.trim()) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/auth/update-profile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:  editName.trim(),
          phone: editPhone.trim(),
        }),
      });

      if (res.ok) {
        setUser((prev) =>
          prev
            ? { ...prev, name: editName.trim(), phone: editPhone.trim() }
            : prev
        );
        setEditing(false);
        setSaveMsg("Profile updated! ✅");
        setTimeout(() => setSaveMsg(""), 3000);
      } else {
        setSaveMsg("Failed to update. Please try again.");
      }
    } catch {
      setSaveMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut(auth);
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore — proceed with redirect
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-[3px] border-slate-200 border-t-orange-500 rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-medium">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const avgOrder = user.totalOrders > 0
    ? user.totalSpent / user.totalOrders
    : 0;
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#F5F5F5]">

      {/* ── Hero Section ── */}
      <div className="relative overflow-hidden">
        <div className="bg-gradient-to-br from-orange-500 via-orange-600 to-red-500 relative">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute top-20 -left-8 w-28 h-28 rounded-full bg-white/5" />
          <div className="absolute bottom-8 right-16 w-16 h-16 rounded-full bg-white/5" />

          {/* Top Navigation */}
          <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 pt-[max(3rem,env(safe-area-inset-top))] pb-0">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push("/menu")}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </motion.button>

            <h2 className="text-white/90 text-sm font-bold tracking-wide">MY PROFILE</h2>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white/15 backdrop-blur-md text-white text-xs font-bold border border-white/20 shadow-lg disabled:opacity-50"
            >
              {loggingOut ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </>
              )}
            </motion.button>
          </div>

          {/* Profile Info */}
          <div className="relative z-10 px-4 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-14">
            <div className="flex items-start sm:items-center gap-4 sm:gap-5">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="shrink-0 w-[72px] h-[72px] sm:w-20 sm:h-20 rounded-[22px] sm:rounded-3xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl sm:text-3xl font-black border-[3px] border-white/30 shadow-xl"
              >
                {initials}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex-1 min-w-0"
              >
                <h1 className="text-xl sm:text-2xl font-black text-white leading-tight truncate">
                  {user.name}
                </h1>
                {user.email && (
                  <p className="text-white/65 text-xs sm:text-sm mt-0.5 truncate flex items-center gap-1.5">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </p>
                )}
                {user.phone && (
                  <p className="text-white/55 text-xs mt-0.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    {user.phone}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full capitalize border border-white/10">
                    {user.role}
                  </span>
                  {user.totalOrders >= 10 && (
                    <span className="bg-amber-400/90 text-amber-900 text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <Star className="w-3 h-3" /> VIP
                    </span>
                  )}
                  {user.totalOrders >= 5 && user.totalOrders < 10 && (
                    <span className="bg-white/20 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 border border-white/10">
                      <Sparkles className="w-3 h-3" /> Regular
                    </span>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          <div className="h-8 bg-[#F5F5F5] rounded-t-[38px]" />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="max-w-lg mx-auto px-4 sm:px-6 -mt-7 space-y-6 pb-12">

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-2.5 sm:gap-3"
        >
          {[
            { label: "Orders",    value: user.totalOrders,           icon: ShoppingBag, color: "bg-blue-50",   iconColor: "text-blue-600" },
            { label: "Spent",     value: formatCurrency(user.totalSpent), icon: IndianRupee, color: "bg-green-50",  iconColor: "text-green-600" },
            { label: "Avg Order", value: formatCurrency(avgOrder),   icon: IndianRupee, color: "bg-purple-50", iconColor: "text-purple-600" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-[18px] p-3 sm:p-4 text-center"
              style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${stat.color} flex items-center justify-center mx-auto mb-2`}>
                <stat.icon className={`w-4 h-4 sm:w-[18px] sm:h-[18px] ${stat.iconColor}`} />
              </div>
              <p className="text-base sm:text-lg font-black text-slate-900 leading-tight truncate px-1">
                {stat.value}
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        {/* Admin Button */}
        {(user.role === "admin" || user.role === "super_admin") && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push("/admin")}
            className="w-full bg-slate-900 text-white rounded-[18px] p-4 flex items-center justify-between"
            style={{ boxShadow: "0 4px 20px rgba(15,23,42,0.25)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-black">Admin Dashboard</p>
                <p className="text-[11px] text-white/50 font-medium">Manage your restaurant</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/50" />
          </motion.button>
        )}

        {/* Save Message */}
        <AnimatePresence>
          {saveMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="bg-green-50 border-2 border-green-200 text-green-700 text-sm font-bold rounded-2xl px-4 py-3 text-center"
            >
              {saveMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-[18px] p-1.5"
          style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
        >
          <div className="flex gap-1.5">
            {([
              { key: "orders" as const, label: "My Orders", icon: ShoppingBag },
              { key: "info"   as const, label: "Account",   icon: Edit2 },
            ] as const).map((tab) => (
              <motion.button
                key={tab.key}
                whileTap={{ scale: 0.97 }}
                onClick={() => { setActiveTab(tab.key); setEditing(false); }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-[14px] text-xs font-bold transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">

          {/* Orders Tab */}
          {activeTab === "orders" && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {orders.length === 0 ? (
                <div
                  className="bg-white rounded-[20px] p-10 sm:p-12 text-center"
                  style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-[20px] mx-auto flex items-center justify-center mb-4"
                  >
                    <ShoppingBag className="w-8 h-8 sm:w-10 sm:h-10 text-slate-300" />
                  </motion.div>
                  <p className="text-base font-black text-slate-600">No orders yet</p>
                  <p className="text-xs text-slate-400 font-medium mt-1">
                    Your order history will appear here
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => router.push("/menu")}
                    className="mt-6 h-12 px-8 bg-orange-500 text-white text-sm font-black rounded-2xl shadow-lg shadow-orange-200 inline-flex items-center gap-2"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    Browse Menu
                  </motion.button>
                </div>
              ) : (
                orders.map((order, idx) => {
                  const items      = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
                  const cfg        = statusConfig[order.status ?? "pending"] ?? statusConfig.pending;
                  const StatusIcon = cfg.icon;

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="bg-white rounded-[18px] overflow-hidden cursor-pointer group"
                      style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
                    >
                      <div className="p-4 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm sm:text-[15px] font-black text-slate-900 font-mono tracking-tight">
                              #{order.orderNumber}
                            </p>
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                              {timeAgo(order.createdAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {order.tableId && (
                              <span className="bg-slate-100 text-slate-500 text-[9px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 border border-slate-200">
                                <QrCode className="w-2.5 h-2.5" />
                                <span className="hidden sm:inline">Table</span> {order.tableId}
                              </span>
                            )}
                            <span className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-lg border ${cfg.bg} ${cfg.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                              <span className="sm:hidden">{cfg.label.slice(0, 4)}</span>
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500 line-clamp-1 mt-2 font-medium leading-relaxed">
                          {items.map((i) => `${i.quantity}× ${i.name}`).join(" • ")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between px-4 py-3 bg-slate-50/60 border-t border-slate-100">
                        <p className="text-base sm:text-lg font-black text-slate-900">
                          {formatCurrency(order.total)}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-orange-500 font-bold group-hover:gap-2 transition-all">
                          <span className="hidden sm:inline">View Details</span>
                          <span className="sm:hidden">View</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* Account Tab */}
          {activeTab === "info" && (
            <motion.div
              key="info"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div
                className="bg-white rounded-[20px] overflow-hidden"
                style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-black text-slate-900">Personal Details</h3>
                  {!editing ? (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setEditing(true)}
                      className="flex items-center gap-1.5 text-xs font-bold text-orange-500 hover:text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </motion.button>
                  ) : (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        setEditing(false);
                        setEditName(user.name);
                        setEditPhone(user.phone);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" /> Cancel
                    </motion.button>
                  )}
                </div>

                <div className="p-4 sm:p-5 space-y-5">
                  {/* Name */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">
                      Full Name
                    </label>
                    {editing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-400 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal"
                        placeholder="Enter your name"
                      />
                    ) : (
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                          <span className="text-sm font-black text-orange-600">{initials}</span>
                        </div>
                        <p className="text-sm font-bold text-slate-900 truncate">{user.name}</p>
                      </div>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">
                      Phone Number
                    </label>
                    {editing ? (
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="tel"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                          placeholder="10-digit number"
                          className="w-full h-12 pl-11 pr-4 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-400 focus:bg-white transition-all placeholder:text-slate-400 placeholder:font-normal"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <Phone className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-sm font-bold text-slate-900">
                          {user.phone || <span className="text-slate-400 font-medium">Not added</span>}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Email — Read Only */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">
                      Email Address
                    </label>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                        <Mail className="w-4 h-4 text-slate-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">{user.email}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">Cannot be changed</p>
                      </div>
                    </div>
                  </div>

                  {/* Account Type */}
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] mb-2">
                      Account Type
                    </label>
                    <div className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                        <Sparkles className="w-4 h-4 text-orange-600" />
                      </div>
                      <span className="text-sm font-bold text-slate-900 capitalize">{user.role}</span>
                    </div>
                  </div>

                  {/* Save Button */}
                  <AnimatePresence>
                    {editing && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                      >
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleSaveProfile}
                          disabled={saving || !editName.trim()}
                          className="w-full h-[52px] bg-orange-500 text-white font-black rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-lg shadow-orange-200/60 hover:bg-orange-600 transition-colors text-sm"
                        >
                          {saving ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <><Save className="w-4 h-4" /> Save Changes</>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign Out Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full h-[52px] bg-red-50 border-2 border-red-200 text-red-600 font-black rounded-2xl flex items-center justify-center gap-2.5 hover:bg-red-100 transition-all disabled:opacity-50 text-sm"
          >
            {loggingOut ? (
              <div className="w-5 h-5 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
            ) : (
              <><LogOut className="w-5 h-5" /> Sign Out</>
            )}
          </motion.button>

          <p className="text-[10px] text-center text-slate-400 font-medium mt-3">
            v1.0 • Made with ❤️
          </p>
        </motion.div>
      </div>
    </div>
  );
}