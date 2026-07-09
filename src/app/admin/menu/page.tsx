"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Search, Edit2, Trash2, X, Eye, EyeOff, Flame, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MenuItem, Category } from "@/lib/firebase";

export default function AdminMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/menu").then((r) => r.json()),
      fetch("/api/admin/categories").then((r) => r.json()),
    ]).then(([menuData, catData]) => {
      setItems(menuData.items || []);
      setCategories(catData.categories || []);
    }).finally(() => setLoading(false));
  }, []);

  const refresh = async () => {
    const res = await fetch("/api/admin/menu");
    const data = await res.json();
    setItems(data.items || []);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/admin/menu?id=${id}`, { method: "DELETE" });
    refresh();
  };

  const toggleAvailability = async (item: MenuItem) => {
    await fetch("/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, isAvailable: !item.isAvailable }),
    });
    refresh();
  };

  const filtered = items.filter((item) => {
    const matchSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = filterCategory === "all" || item.categoryId === filterCategory;
    return matchSearch && matchCat;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Menu Items</h1>
          <p className="text-sm text-slate-500 mt-1">{items.length} items</p>
        </div>
        <Button onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Item
        </Button>
      </div>

      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search menu items..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        >
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="grid gap-3">
        {filtered.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex gap-4 bg-white rounded-2xl p-4 shadow-card ${!item.isAvailable ? "opacity-60" : ""}`}
          >
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">🍽️</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${item.isVeg ? "border-green-500" : "border-red-500"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? "bg-green-500" : "bg-red-500"}`} />
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{item.name}</h3>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">{item.description}</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(item.price)}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggleAvailability(item)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${item.isAvailable ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}
                    title={item.isAvailable ? "Mark Unavailable" : "Mark Available"}
                  >
                    {item.isAvailable ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => { setEditItem(item); setShowForm(true); }}
                    className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {item.isFeatured && <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium">Featured</span>}
                {item.isPopular && <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium">Popular</span>}
                {item.isTodaySpecial && <span className="bg-red-100 text-red-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium">Special</span>}
                {item.isRecommended && <span className="bg-green-100 text-green-700 text-[9px] px-1.5 py-0.5 rounded-full font-medium">Recommended</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No menu items found</p>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <MenuItemForm
            item={editItem}
            categories={categories}
            onClose={() => { setShowForm(false); setEditItem(null); }}
            onSave={() => { setShowForm(false); setEditItem(null); refresh(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItemForm({ item, categories, onClose, onSave }: { item: MenuItem | null; categories: Category[]; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price || 0,
    comparePrice: item?.comparePrice || 0,
    image: item?.image || "",
    categoryId: item?.categoryId || categories[0]?.id || "",
    isVeg: item?.isVeg ?? true,
    isAvailable: item?.isAvailable ?? true,
    isFeatured: item?.isFeatured ?? false,
    isPopular: item?.isPopular ?? false,
    isTodaySpecial: item?.isTodaySpecial ?? false,
    isRecommended: item?.isRecommended ?? false,
    spiceLevel: item?.spiceLevel || 0,
    prepTime: item?.prepTime || 15,
    calories: item?.calories || 0,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name || !form.price) return;
    setSaving(true);
    try {
      const method = item ? "PUT" : "POST";
      const body = item ? { ...form, id: item.id } : form;
      await fetch("/api/admin/menu", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onSave();
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
        className="w-full max-w-lg bg-white rounded-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">{item ? "Edit Item" : "Add Item"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full h-20 p-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Price *</label>
              <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Compare Price</label>
              <input type="number" value={form.comparePrice} onChange={(e) => setForm({ ...form, comparePrice: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Image URL</label>
            <input value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Spice (0-5)</label>
              <input type="number" min={0} max={5} value={form.spiceLevel} onChange={(e) => setForm({ ...form, spiceLevel: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Prep (min)</label>
              <input type="number" value={form.prepTime} onChange={(e) => setForm({ ...form, prepTime: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Calories</label>
              <input type="number" value={form.calories} onChange={(e) => setForm({ ...form, calories: Number(e.target.value) })} className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "isVeg" as const, label: "Vegetarian" },
              { key: "isAvailable" as const, label: "Available" },
              { key: "isFeatured" as const, label: "Featured" },
              { key: "isPopular" as const, label: "Popular" },
              { key: "isTodaySpecial" as const, label: "Today's Special" },
              { key: "isRecommended" as const, label: "Recommended" },
            ].map((opt) => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[opt.key]} onChange={(e) => setForm({ ...form, [opt.key]: e.target.checked })} className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400" />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
          <Button onClick={handleSave} loading={saving} className="w-full">
            {item ? "Update Item" : "Add Item"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
