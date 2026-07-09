"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, X, Ticket, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Coupon {
  id:            string;
  code:          string;
  description?:  string;
  discountType:  string;
  discountValue: number;
  minOrderValue?: number;
  maxDiscount?:  number;
  usageLimit?:   number;
  usedCount?:    number;
  isActive?:     boolean;
  restaurantId?: string;
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/coupons");
      const data = await res.json();
      setCoupons(data.coupons || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    await fetch(`/api/admin/coupons?id=${id}`, { method: "DELETE" });
    fetchCoupons();
  };

  const handleToggle = async (coupon: Coupon) => {
    await fetch("/api/admin/coupons", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: coupon.id, isActive: !coupon.isActive }),
    });
    fetchCoupons();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Coupons</h1>
          <p className="text-sm text-slate-500 mt-1">{coupons.length} coupons</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add Coupon
        </Button>
      </div>

      <div className="grid gap-3">
        {coupons.map((coupon) => (
          <motion.div
            key={coupon.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white rounded-2xl p-4 shadow-card flex items-center gap-4 border ${
              coupon.isActive ? "border-transparent" : "border-slate-200 opacity-60"
            }`}
          >
            {/* Icon */}
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
              coupon.isActive
                ? "bg-gradient-to-br from-orange-400 to-red-500"
                : "bg-slate-200"
            }`}>
              <Ticket className="w-6 h-6 text-white" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-900 font-mono tracking-wider">
                  {coupon.code}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  coupon.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-100 text-slate-500"
                }`}>
                  {coupon.isActive ? "ACTIVE" : "INACTIVE"}
                </span>
              </div>

              {coupon.description && (
                <p className="text-xs text-slate-500 mt-0.5">{coupon.description}</p>
              )}

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">
                  {coupon.discountType === "percentage"
                    ? `${coupon.discountValue}% OFF`
                    : `₹${coupon.discountValue} OFF`}
                </span>
                {(coupon.minOrderValue ?? 0) > 0 && (
                  <span className="text-xs text-slate-400">
                    Min: {formatCurrency(coupon.minOrderValue!)}
                  </span>
                )}
                {coupon.maxDiscount && (
                  <span className="text-xs text-slate-400">
                    Max: {formatCurrency(coupon.maxDiscount)}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Used: {coupon.usedCount ?? 0}
                  {coupon.usageLimit ? `/${coupon.usageLimit}` : ""}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <button
                onClick={() => handleToggle(coupon)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  coupon.isActive
                    ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                    : "bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700"
                }`}
              >
                {coupon.isActive ? "Active" : "Inactive"}
              </button>
              <button
                onClick={() => handleDelete(coupon.id)}
                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {coupons.length === 0 && (
        <div className="text-center py-16">
          <Ticket className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">No coupons yet</p>
          <p className="text-xs text-slate-400 mt-1">Create discount coupons for your customers</p>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <CouponForm
            onClose={() => setShowForm(false)}
            onSave={() => { setShowForm(false); fetchCoupons(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Coupon Form ──────────────────────────────────────────────────────────────
function CouponForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [code, setCode]                 = useState("");
  const [description, setDescription]   = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [maxDiscount, setMaxDiscount]   = useState(0);
  const [usageLimit, setUsageLimit]     = useState(0);
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState("");

  const handleSave = async () => {
    if (!code.trim()) { setError("Coupon code required"); return; }
    if (!discountValue) { setError("Discount value required"); return; }

    setSaving(true);
    setError("");
    try {
      const res  = await fetch("/api/admin/coupons", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          code:          code.trim().toUpperCase(),
          description,
          discountType,
          discountValue,
          minOrderValue: minOrderValue || 0,
          maxDiscount:   maxDiscount   || null,
          usageLimit:    usageLimit    || null,
        }),
      });
      const data = await res.json();
      if (data.coupon) {
        onSave();
      } else {
        setError(data.error || "Failed to create coupon");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl"
      >
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">Create Coupon</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Coupon Code *
            </label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              placeholder="e.g. WELCOME20"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm font-mono uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 20% off on first order"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percentage" | "flat")}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Value {discountType === "percentage" ? "(%)" : "(₹)"} *
              </label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                min={1}
                max={discountType === "percentage" ? 100 : undefined}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Min Order (₹)</label>
              <input
                type="number"
                value={minOrderValue}
                onChange={(e) => setMinOrderValue(Number(e.target.value))}
                placeholder="0 = no minimum"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Max Discount (₹)</label>
              <input
                type="number"
                value={maxDiscount}
                onChange={(e) => setMaxDiscount(Number(e.target.value))}
                placeholder="0 = no limit"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Usage Limit (0 = unlimited)
            </label>
            <input
              type="number"
              value={usageLimit}
              onChange={(e) => setUsageLimit(Number(e.target.value))}
              placeholder="How many times can this be used?"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Preview */}
          {code && discountValue > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs font-bold text-orange-700 mb-1">Preview:</p>
              <p className="text-sm text-slate-700">
                Code: <span className="font-mono font-bold text-orange-600">{code}</span>
              </p>
              <p className="text-sm text-slate-700">
                Discount: <span className="font-bold text-green-600">
                  {discountType === "percentage" ? `${discountValue}% off` : `₹${discountValue} off`}
                </span>
                {maxDiscount > 0 && <span className="text-slate-500"> (max ₹{maxDiscount})</span>}
              </p>
              {minOrderValue > 0 && (
                <p className="text-xs text-slate-500">Min order: ₹{minOrderValue}</p>
              )}
            </div>
          )}

          <Button onClick={handleSave} loading={saving} className="w-full">
            Create Coupon
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}