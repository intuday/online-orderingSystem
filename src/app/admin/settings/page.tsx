"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Store, Receipt, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Restaurant } from "@/lib/firebase";

export default function SettingsPage() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    address: "",
    phone: "",
    email: "",
    gstNumber: "",
    gstRate: 5,
    currency: "INR",
    paymentMode: "both",
    logo: "",
  });

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.restaurant) {
          setRestaurant(d.restaurant);
          setForm({
            name: d.restaurant.name || "",
            description: d.restaurant.description || "",
            address: d.restaurant.address || "",
            phone: d.restaurant.phone || "",
            email: d.restaurant.email || "",
            gstNumber: d.restaurant.gstNumber || "",
            gstRate: d.restaurant.gstRate || 5,
            currency: d.restaurant.currency || "INR",
            paymentMode: d.restaurant.paymentMode || "both",
            logo: d.restaurant.logo || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your restaurant configuration</p>
      </div>

      {/* Restaurant Info */}
      <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Store className="w-5 h-5 text-orange-500" />
          <h2 className="text-base font-bold text-slate-900">Restaurant Information</h2>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Restaurant Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-20 p-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Logo URL</label>
          <input value={form.logo} onChange={(e) => setForm({ ...form, logo: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        </div>
      </div>

      {/* Tax & GST */}
      <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Receipt className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-bold text-slate-900">Tax & GST</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">GST Number</label>
            <input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">GST Rate (%)</label>
            <input type="number" value={form.gstRate} onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Currency</label>
          <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="INR">Indian Rupee (₹)</option>
            <option value="USD">US Dollar ($)</option>
            <option value="EUR">Euro (€)</option>
            <option value="GBP">British Pound (£)</option>
          </select>
        </div>
      </div>

      {/* Payment */}
      <div className="bg-white rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-5 h-5 text-green-500" />
          <h2 className="text-base font-bold text-slate-900">Payment Mode</h2>
        </div>
        <div className="space-y-2">
          {[
            { value: "counter", label: "Pay at Counter Only", desc: "Customers pay in person after eating" },
            { value: "online", label: "Online Payment Only", desc: "Customers pay online before ordering" },
            { value: "both", label: "Both Options", desc: "Customers choose their payment method" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.paymentMode === opt.value ? "border-primary bg-orange-50" : "border-slate-200"}`}
            >
              <input
                type="radio"
                name="paymentMode"
                value={opt.value}
                checked={form.paymentMode === opt.value}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
                className="w-4 h-4 text-orange-500 focus:ring-orange-400"
              />
              <div>
                <p className="text-sm font-medium text-slate-900">{opt.label}</p>
                <p className="text-xs text-slate-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} loading={saving} className="min-w-[140px]">
          <Save className="w-4 h-4 mr-1" /> Save Settings
        </Button>
        {saved && (
          <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-sm text-green-600 font-medium">
            ✓ Settings saved successfully
          </motion.span>
        )}
      </div>
    </div>
  );
}
