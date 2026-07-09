"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, X, ImageIcon, ChevronDown,
  Gift, ShoppingBag, Tag, Percent, Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MenuItem {
  id:         string;
  name:       string;
  price:      number;
  categoryId: string;
  image?:     string;
  isVeg?:     boolean;
}

interface Category {
  id:   string;
  name: string;
  icon?: string;
}

interface Offer {
  id:            string;
  title:         string;
  description?:  string;
  image?:        string;
  offerType:     string;
  discountType:  string;
  discountValue: number;
  isActive:      boolean;
  condition?: {
    requiredItemIds?:     string[];
    requiredCategoryIds?: string[];
    minQuantity:          number;
    minSubtotal?:         number;
    matchType:            string;
  };
  reward?: {
    rewardItemIds: string[];
    promoPrice:    number;
    maxQuantity:   number;
    autoAdd:       boolean;
  };
  comboItems?: Array<{
    menuItemId:    string;
    name:          string;
    quantity:      number;
    originalPrice: number;
  }>;
  comboPrice?: number;
}

const OFFER_TYPES = [
  { value: "discount",      label: "Simple Discount",  icon: Percent,     desc: "% ya ₹ off on order" },
  { value: "combo",         label: "Combo Meal",        icon: Package,     desc: "Fixed price combo (e.g. ₹99 meal)" },
  { value: "bxgy",          label: "Buy X Get Y",       icon: Gift,        desc: "Buy 2 get 1 free type offers" },
  { value: "free_item",     label: "Free Item",         icon: ShoppingBag, desc: "Free item on min order" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OffersPage() {
  const [offers, setOffers]         = useState<Offer[]>([]);
  const [menuItems, setMenuItems]   = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const [offersRes, menuRes, catRes] = await Promise.all([
        fetch("/api/admin/offers"),
        fetch("/api/admin/menu"),
        fetch("/api/admin/categories"),
      ]);
      const [offersData, menuData, catData] = await Promise.all([
        offersRes.json(),
        menuRes.json(),
        catRes.json(),
      ]);
      setOffers(offersData.offers  || []);
      setMenuItems(menuData.items  || []);
      setCategories(catData.categories || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this offer?")) return;
    await fetch(`/api/admin/offers?id=${id}`, { method: "DELETE" });
    fetchOffers();
  };

  const handleToggle = async (offer: Offer) => {
    await fetch("/api/admin/offers", {
      method:  "PUT",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: offer.id, isActive: !offer.isActive }),
    });
    fetchOffers();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Offers & Combos</h1>
          <p className="text-sm text-slate-500 mt-1">{offers.length} offers</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-1" /> Create Offer
        </Button>
      </div>

      {/* Offer Type Legend */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {OFFER_TYPES.map((type) => (
          <div key={type.value} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <type.icon className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-slate-700">{type.label}</span>
            </div>
            <p className="text-[10px] text-slate-500">{type.desc}</p>
          </div>
        ))}
      </div>

      {/* Offers List */}
      <div className="grid gap-4 md:grid-cols-2">
        {offers.map((offer) => (
          <OfferCard
            key={offer.id}
            offer={offer}
            menuItems={menuItems}
            onDelete={() => handleDelete(offer.id)}
            onToggle={() => handleToggle(offer)}
          />
        ))}
      </div>

      {offers.length === 0 && (
        <div className="text-center py-16">
          <ImageIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">No offers yet</p>
          <p className="text-xs text-slate-400 mt-1">Create combo meals, BXGY offers and more</p>
        </div>
      )}

      {/* Create Form */}
      <AnimatePresence>
        {showForm && (
          <OfferForm
            menuItems={menuItems}
            categories={categories}
            onClose={() => setShowForm(false)}
            onSave={() => { setShowForm(false); fetchOffers(); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Offer Card ───────────────────────────────────────────────────────────────
function OfferCard({
  offer, menuItems, onDelete, onToggle,
}: {
  offer:     Offer;
  menuItems: MenuItem[];
  onDelete:  () => void;
  onToggle:  () => void;
}) {
  const typeConfig: Record<string, { color: string; label: string }> = {
    discount:  { color: "bg-blue-100 text-blue-700",   label: "Discount" },
    combo:     { color: "bg-purple-100 text-purple-700", label: "Combo" },
    bxgy:      { color: "bg-orange-100 text-orange-700", label: "BXGY" },
    free_item: { color: "bg-green-100 text-green-700",  label: "Free Item" },
  };
  const cfg = typeConfig[offer.offerType] || typeConfig.discount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`bg-white rounded-2xl overflow-hidden shadow-card border ${
        offer.isActive ? "border-transparent" : "border-slate-200 opacity-60"
      }`}
    >
      {offer.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={offer.image} alt={offer.title} className="w-full h-36 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                {cfg.label}
              </span>
              {!offer.isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  INACTIVE
                </span>
              )}
            </div>
            <h3 className="text-sm font-bold text-slate-900">{offer.title}</h3>
            {offer.description && (
              <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{offer.description}</p>
            )}

            {/* Offer Details based on type */}
            <div className="mt-2 space-y-1">
              {offer.offerType === "combo" && offer.comboItems && offer.comboItems.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-400">Includes:</p>
                  {offer.comboItems.map((ci, i) => (
                    <p key={i} className="text-[10px] text-slate-600">
                      {ci.quantity}x {ci.name} ({formatCurrency(ci.originalPrice)})
                    </p>
                  ))}
                  {offer.comboPrice && (
                    <p className="text-xs font-bold text-green-600 mt-1">
                      Combo Price: {formatCurrency(offer.comboPrice)}
                    </p>
                  )}
                </div>
              )}

              {offer.offerType === "bxgy" && offer.condition && offer.reward && (
                <div>
                  <p className="text-[10px] text-slate-600">
                    Buy {offer.condition.minQuantity}+ items →
                    Get reward @ {offer.reward.promoPrice === 0 ? "FREE" : formatCurrency(offer.reward.promoPrice)}
                  </p>
                  {offer.reward.rewardItemIds.length > 0 && (
                    <p className="text-[10px] text-slate-400">
                      {offer.reward.rewardItemIds.length} reward choice(s)
                    </p>
                  )}
                </div>
              )}

              {offer.offerType === "free_item" && offer.condition && offer.reward && (
                <p className="text-[10px] text-slate-600">
                  On orders above {formatCurrency(offer.condition.minSubtotal || 0)} →
                  Free item
                </p>
              )}

              {offer.offerType === "discount" && (
                <span className="inline-block bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {offer.discountValue}
                  {offer.discountType === "percentage" ? "% OFF" : " ₹ OFF"}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 shrink-0">
            <button
              onClick={onToggle}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                offer.isActive
                  ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700"
                  : "bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700"
              }`}
            >
              {offer.isActive ? "Active" : "Inactive"}
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Offer Form ───────────────────────────────────────────────────────────────
function OfferForm({
  menuItems, categories, onClose, onSave,
}: {
  menuItems:  MenuItem[];
  categories: Category[];
  onClose:    () => void;
  onSave:     () => void;
}) {
  const [step, setStep]           = useState<"type" | "details">("type");
  const [offerType, setOfferType] = useState<string>("");
  const [saving, setSaving]       = useState(false);

  // Common fields
  const [title, setTitle]           = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage]           = useState("");
  const [isActive, setIsActive]     = useState(true);

  // Discount fields
  const [discountType, setDiscountType]   = useState<"percentage" | "flat">("percentage");
  const [discountValue, setDiscountValue] = useState(10);

  // Combo fields
  const [comboItems, setComboItems] = useState<Array<{ menuItemId: string; name: string; quantity: number; originalPrice: number }>>([]);
  const [comboPrice, setComboPrice] = useState(0);

  // BXGY / Free Item fields
  const [conditionType, setConditionType]         = useState<"items" | "category" | "subtotal">("items");
  const [conditionItemIds, setConditionItemIds]   = useState<string[]>([]);
  const [conditionCategoryIds, setConditionCategoryIds] = useState<string[]>([]);
  const [minQuantity, setMinQuantity]             = useState(2);
  const [minSubtotal, setMinSubtotal]             = useState(500);
  const [matchType, setMatchType]                 = useState<"all" | "any">("any");
  const [rewardItemIds, setRewardItemIds]         = useState<string[]>([]);
  const [promoPrice, setPromoPrice]               = useState(0);
  const [autoAdd, setAutoAdd]                     = useState(false);

  const addComboItem = (menuItem: MenuItem) => {
    const existing = comboItems.find((ci) => ci.menuItemId === menuItem.id);
    if (existing) {
      setComboItems((prev) =>
        prev.map((ci) =>
          ci.menuItemId === menuItem.id
            ? { ...ci, quantity: ci.quantity + 1 }
            : ci
        )
      );
    } else {
      setComboItems((prev) => [
        ...prev,
        { menuItemId: menuItem.id, name: menuItem.name, quantity: 1, originalPrice: menuItem.price },
      ]);
    }
  };

  const removeComboItem = (menuItemId: string) => {
    setComboItems((prev) => prev.filter((ci) => ci.menuItemId !== menuItemId));
  };

  const comboOriginalTotal = comboItems.reduce(
    (sum, ci) => sum + ci.originalPrice * ci.quantity, 0
  );

  const toggleConditionItem = (id: string) => {
    setConditionItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleConditionCategory = (id: string) => {
    setConditionCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleRewardItem = (id: string) => {
    setRewardItemIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title, description, image, offerType, isActive,
        discountType, discountValue,
      };

      if (offerType === "combo") {
        body.comboItems = comboItems;
        body.comboPrice = comboPrice;
        body.condition  = { minQuantity: 1, matchType: "all" };
        body.reward     = { rewardItemIds: [], promoPrice: 0, maxQuantity: 1, autoAdd: false };
      }

      if (offerType === "bxgy" || offerType === "free_item") {
        body.condition = {
          requiredItemIds:     conditionType === "items"    ? conditionItemIds    : [],
          requiredCategoryIds: conditionType === "category" ? conditionCategoryIds : [],
          minQuantity:         conditionType === "subtotal" ? 1 : minQuantity,
          minSubtotal:         conditionType === "subtotal" ? minSubtotal : 0,
          matchType,
        };
        body.reward = {
          rewardItemIds,
          promoPrice,
          maxQuantity: 1,
          autoAdd,
        };
      }

      await fetch("/api/admin/offers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
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
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[92vh] flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold">
              {step === "type" ? "Select Offer Type" : `Create ${OFFER_TYPES.find((t) => t.value === offerType)?.label}`}
            </h2>
            {step === "details" && (
              <button onClick={() => setStep("type")} className="text-xs text-orange-500 font-medium mt-0.5">
                ← Change type
              </button>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Step 1: Select Type */}
          {step === "type" && (
            <div className="p-5 grid grid-cols-2 gap-3">
              {OFFER_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => { setOfferType(type.value); setStep("details"); }}
                  className="flex flex-col items-start p-4 rounded-2xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 transition-all text-left group"
                >
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mb-3 group-hover:bg-orange-500 transition-colors">
                    <type.icon className="w-5 h-5 text-orange-600 group-hover:text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{type.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">{type.desc}</p>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Details */}
          {step === "details" && (
            <div className="p-5 space-y-5">

              {/* Common Fields */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Offer Title *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      offerType === "combo"     ? "e.g. Family Combo @ ₹299" :
                      offerType === "bxgy"      ? "e.g. Buy 2 Pizzas, Get Garlic Bread @ ₹9" :
                      offerType === "free_item" ? "e.g. Free Coke on ₹500+ orders" :
                      "e.g. 20% Off on all orders"
                    }
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Offer details..."
                    className="w-full h-16 p-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Banner Image URL</label>
                  <input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://..."
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="preview" className="mt-2 w-full h-28 object-cover rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                </div>
              </div>

              {/* ── DISCOUNT TYPE ── */}
              {offerType === "discount" && (
                <div className="space-y-3 border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-900">Discount Settings</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Discount Type</label>
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as "percentage" | "flat")}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="flat">Flat Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Value ({discountType === "percentage" ? "%" : "₹"})
                      </label>
                      <input
                        type="number"
                        value={discountValue}
                        onChange={(e) => setDiscountValue(Number(e.target.value))}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── COMBO TYPE ── */}
              {offerType === "combo" && (
                <div className="space-y-4 border border-slate-200 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-slate-900">Combo Items</h3>

                  {/* Selected combo items */}
                  {comboItems.length > 0 && (
                    <div className="space-y-2">
                      {comboItems.map((ci) => (
                        <div key={ci.menuItemId} className="flex items-center justify-between bg-orange-50 rounded-xl p-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-orange-500 text-white rounded-lg text-xs font-bold flex items-center justify-center">
                              {ci.quantity}x
                            </span>
                            <span className="text-sm font-medium text-slate-900">{ci.name}</span>
                            <span className="text-xs text-slate-500">{formatCurrency(ci.originalPrice)}</span>
                          </div>
                          <button onClick={() => removeComboItem(ci.menuItemId)} className="w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-bold pt-2 border-t border-orange-200">
                        <span className="text-slate-600">Original Total:</span>
                        <span className="text-slate-500 line-through">{formatCurrency(comboOriginalTotal)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add items */}
                  <div>
                    <p className="text-xs font-medium text-slate-600 mb-2">Add Items to Combo:</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {menuItems.map((mi) => (
                        <button
                          key={mi.id}
                          onClick={() => addComboItem(mi)}
                          className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-100 text-left transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-sm border ${mi.isVeg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"}`} />
                            <span className="text-sm text-slate-700">{mi.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">{formatCurrency(mi.price)}</span>
                            <Plus className="w-3.5 h-3.5 text-orange-500" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Combo Price */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      Combo Price (₹) *
                      {comboOriginalTotal > 0 && comboPrice > 0 && (
                        <span className="text-green-600 ml-2">
                          Save {formatCurrency(comboOriginalTotal - comboPrice)}!
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={comboPrice}
                      onChange={(e) => setComboPrice(Number(e.target.value))}
                      placeholder="e.g. 299"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              )}

              {/* ── BXGY / FREE ITEM TYPE ── */}
              {(offerType === "bxgy" || offerType === "free_item") && (
                <div className="space-y-4">

                  {/* CONDITION */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      🛒 Condition (What user must buy)
                    </h3>

                    <div className="flex gap-2">
                      {[
                        { value: "items",    label: "Specific Items" },
                        { value: "category", label: "Category" },
                        { value: "subtotal", label: "Min Amount" },
                      ].map((t) => (
                        <button
                          key={t.value}
                          onClick={() => setConditionType(t.value as any)}
                          className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                            conditionType === t.value
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Specific Items */}
                    {conditionType === "items" && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Select required items:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {menuItems.map((mi) => (
                            <label key={mi.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={conditionItemIds.includes(mi.id)}
                                onChange={() => toggleConditionItem(mi.id)}
                                className="w-4 h-4 rounded border-slate-300 text-orange-500"
                              />
                              <span className={`w-2.5 h-2.5 rounded-sm border shrink-0 ${mi.isVeg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"}`} />
                              <span className="text-sm text-slate-700 flex-1">{mi.name}</span>
                              <span className="text-xs text-slate-500">{formatCurrency(mi.price)}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Min Quantity needed
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={minQuantity}
                            onChange={(e) => setMinQuantity(Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Match Type</label>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setMatchType("any")}
                              className={`flex-1 h-8 rounded-lg text-xs font-medium ${matchType === "any" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                            >
                              Any of selected
                            </button>
                            <button
                              onClick={() => setMatchType("all")}
                              className={`flex-1 h-8 rounded-lg text-xs font-medium ${matchType === "all" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
                            >
                              All of selected
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Category */}
                    {conditionType === "category" && (
                      <div>
                        <p className="text-xs text-slate-500 mb-2">Select required categories:</p>
                        <div className="space-y-1">
                          {categories.map((cat) => (
                            <label key={cat.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={conditionCategoryIds.includes(cat.id)}
                                onChange={() => toggleConditionCategory(cat.id)}
                                className="w-4 h-4 rounded border-slate-300 text-orange-500"
                              />
                              <span className="text-sm">{cat.icon} {cat.name}</span>
                            </label>
                          ))}
                        </div>
                        <div className="mt-2">
                          <label className="block text-xs font-medium text-slate-600 mb-1">Min Quantity from category</label>
                          <input
                            type="number"
                            min={1}
                            value={minQuantity}
                            onChange={(e) => setMinQuantity(Number(e.target.value))}
                            className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                      </div>
                    )}

                    {/* Subtotal */}
                    {conditionType === "subtotal" && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Min Cart Amount (₹)</label>
                        <input
                          type="number"
                          value={minSubtotal}
                          onChange={(e) => setMinSubtotal(Number(e.target.value))}
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* REWARD */}
                  <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      🎁 Reward (What user gets)
                    </h3>

                    <div>
                      <p className="text-xs text-slate-500 mb-2">
                        Select reward items (user chooses one):
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {menuItems.map((mi) => (
                          <label key={mi.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={rewardItemIds.includes(mi.id)}
                              onChange={() => toggleRewardItem(mi.id)}
                              className="w-4 h-4 rounded border-slate-300 text-orange-500"
                            />
                            <span className={`w-2.5 h-2.5 rounded-sm border shrink-0 ${mi.isVeg ? "border-green-500 bg-green-500" : "border-red-500 bg-red-500"}`} />
                            <span className="text-sm text-slate-700 flex-1">{mi.name}</span>
                            <span className="text-xs text-slate-500 line-through">{formatCurrency(mi.price)}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Promotional Price for Reward Item
                      </label>
                      <div className="flex gap-2">
                        {[0, 9, 19, 29, 49].map((p) => (
                          <button
                            key={p}
                            onClick={() => setPromoPrice(p)}
                            className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all ${
                              promoPrice === p
                                ? "bg-green-500 text-white"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {p === 0 ? "FREE" : `₹${p}`}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        value={promoPrice}
                        onChange={(e) => setPromoPrice(Number(e.target.value))}
                        placeholder="Custom price"
                        className="w-full h-9 px-3 rounded-lg border border-slate-200 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAdd}
                        onChange={(e) => setAutoAdd(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-orange-500"
                      />
                      <span className="text-sm text-slate-700">Auto-add reward (no choice popup)</span>
                      <span className="text-[10px] text-slate-400">(Only works if 1 reward item selected)</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Active Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsActive(!isActive)}
                  className={`relative w-10 h-6 rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-slate-300"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-1"}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {isActive ? "Active - Users can see this offer" : "Inactive - Hidden from users"}
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "details" && (
          <div className="p-5 border-t border-slate-100 shrink-0">
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!title.trim() || (offerType === "combo" && (comboItems.length === 0 || comboPrice === 0))}
              className="w-full"
            >
              Create {OFFER_TYPES.find((t) => t.value === offerType)?.label || "Offer"}
            </Button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}