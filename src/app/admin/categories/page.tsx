// src/app/admin/categories/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence }          from "framer-motion";
import { Plus, Edit2, Trash2, X, GripVertical } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/lib/types";

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);

  // ✅ Declared before useEffect — wrapped in useCallback for stable reference
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
      fetchCategories();
    } catch (error) {
      console.error("Failed to delete category:", error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categories</h1>
          <p className="text-sm text-slate-500 mt-1">{categories.length} categories</p>
        </div>
        <Button onClick={() => { setEditCategory(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Add Category
        </Button>
      </div>

      <div className="grid gap-3">
        {categories.map((cat) => (
          <motion.div
            key={cat.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center gap-4 bg-white rounded-2xl p-4 shadow-card ${!cat.isActive ? "opacity-50" : ""}`}
          >
            <GripVertical className="w-5 h-5 text-slate-300 shrink-0 cursor-grab" />
            <span className="text-2xl">{cat.icon || "📂"}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">{cat.name}</h3>
              <p className="text-xs text-slate-400">/{cat.slug}</p>
            </div>
            <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${
              cat.isActive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}>
              {cat.isActive ? "Active" : "Inactive"}
            </span>
            <button
              onClick={() => { setEditCategory(cat); setShowForm(true); }}
              className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(cat.id)}
              className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-400">No categories yet. Create one to get started.</p>
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <CategoryForm
            category={editCategory}
            onClose={() => { setShowForm(false); setEditCategory(null); }}
            onSave={() => { setShowForm(false); setEditCategory(null); fetchCategories(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Category Form ────────────────────────────────────────────────────────────

function CategoryForm({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose:  () => void;
  onSave:   () => void;
}) {
  const [name, setSortName]   = useState(category?.name      ?? "");
  const [icon, setIcon]       = useState(category?.icon      ?? "");
  const [sortOrder, setSortOrder] = useState(category?.sortOrder ?? 0);
  const [isActive, setIsActive]   = useState(category?.isActive  ?? true);
  const [saving, setSaving]       = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const method = category ? "PUT" : "POST";
      const body   = category
        ? { id: category.id, name, icon, sortOrder, isActive }
        : { name, icon, sortOrder, isActive };

      await fetch("/api/admin/categories", {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      onSave();
    } catch (error) {
      console.error("Failed to save category:", error);
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
          <h2 className="text-lg font-bold">{category ? "Edit" : "Add"} Category</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
            <input
              value={name}
              onChange={(e) => setSortName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Icon (emoji)</label>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🍔"
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Sort Order</label>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-400"
            />
            <span className="text-sm text-slate-700">Active</span>
          </label>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving..." : `${category ? "Update" : "Create"} Category`}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}