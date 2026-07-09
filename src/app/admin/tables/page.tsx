"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Download,
  Trash2,
  X,
  QrCode,
  Users,
  RefreshCw,
  Clock,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Table {
  id: string;
  number: number;
  name: string;
  capacity: number;
  status: string;
  qrCode?: string;
  restaurantId: string;
  currentOrderId?: string | null;
  occupiedBy?: string | null;
  occupiedAt?: any;
  clearedAt?: any;
}

function getTimeAgo(ts: any): string {
  if (!ts) return "";
  const ms =
    ts?._seconds ? ts._seconds * 1000 :
    ts?.seconds ? ts.seconds * 1000 :
    typeof ts === "string" ? new Date(ts).getTime() :
    0;

  if (!ms) return "";

  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);

  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function TablesPage() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showQR, setShowQR] = useState<Table | null>(null);

  const fetchTables = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch(`/api/admin/tables?ts=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await res.json();
      setTables([...(data.tables || [])]);
    } catch (error) {
      console.error("Failed to fetch tables:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTables();

    const interval = setInterval(() => fetchTables(true), 3000);

    const onFocus = () => fetchTables(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchTables(true);
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchTables]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this table?")) return;
    await fetch(`/api/admin/tables?id=${id}`, { method: "DELETE" });
    fetchTables(true);
  };

  const downloadQR = (table: Table) => {
    if (!table.qrCode) return;
    const link = document.createElement("a");
    link.download = `table-${table.number}-qr.png`;
    link.href = table.qrCode;
    link.click();
  };

  const toggleStatus = async (table: Table) => {
    const newStatus = table.status === "available" ? "occupied" : "available";

    const payload: Record<string, unknown> = {
      id: table.id,
      status: newStatus,
    };

    if (newStatus === "available") {
      payload.currentOrderId = null;
      payload.occupiedBy = null;
      payload.occupiedAt = null;
      payload.clearedAt = new Date().toISOString();
    }

    await fetch("/api/admin/tables", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    fetchTables(true);
  };

  const statusColor: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    occupied: "bg-red-100 text-red-700",
    reserved: "bg-amber-100 text-amber-700",
  };

  const availableCount = tables.filter((t) => t.status === "available").length;
  const occupiedCount = tables.filter((t) => t.status === "occupied").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
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
          <h1 className="text-2xl font-bold text-slate-900">Tables & QR Codes</h1>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-sm text-slate-500">{tables.length} tables</p>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              {availableCount} available
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
              {occupiedCount} occupied
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchTables(true)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin" : ""}`} />
          </button>

          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Table
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tables.map((table) => (
          <motion.div
            key={`${table.id}-${table.status}-${table.occupiedAt?._seconds || table.occupiedAt || ""}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-5 shadow-card text-center space-y-3 border border-slate-100"
          >
            <div className={`w-14 h-14 rounded-2xl mx-auto flex items-center justify-center ${
              table.status === "occupied" ? "bg-red-50" : "bg-slate-100"
            }`}>
              <span className={`text-2xl font-bold ${
                table.status === "occupied" ? "text-red-600" : "text-slate-700"
              }`}>
                {table.number}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">{table.name}</h3>
              <div className="flex items-center justify-center gap-1 mt-1 text-xs text-slate-500">
                <Users className="w-3 h-3" />
                <span>{table.capacity} seats</span>
              </div>
            </div>

            <button
              onClick={() => toggleStatus(table)}
              className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase mx-auto block ${
                statusColor[table.status || "available"]
              }`}
            >
              {table.status}
            </button>

            {/* Occupied details */}
            {table.status === "occupied" && (
              <div className="space-y-1">
                {table.occupiedBy && (
                  <p className="text-[10px] text-red-600 font-medium flex items-center justify-center gap-1">
                    <UserRound className="w-3 h-3" />
                    {table.occupiedBy}
                  </p>
                )}
                {table.occupiedAt && (
                  <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3" />
                    {getTimeAgo(table.occupiedAt)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2 justify-center">
              {table.qrCode && (
                <>
                  <button
                    onClick={() => setShowQR(table)}
                    className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => downloadQR(table)}
                    className="w-8 h-8 rounded-lg bg-green-50 text-green-600 flex items-center justify-center"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
              <button
                onClick={() => handleDelete(table.id)}
                className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {tables.length === 0 && (
        <div className="text-center py-12">
          <QrCode className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm text-slate-400">No tables yet. Add tables to generate QR codes.</p>
        </div>
      )}

      {/* QR Preview Modal */}
      <AnimatePresence>
        {showQR && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowQR(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full"
            >
              <h2 className="text-lg font-bold mb-4">{showQR.name} QR Code</h2>
              {showQR.qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={showQR.qrCode} alt={`QR Code for ${showQR.name}`} className="w-64 h-64 mx-auto" />
              )}
              <p className="text-xs text-slate-400 mt-4">Scan to open menu for {showQR.name}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setShowQR(null)} className="flex-1">
                  Close
                </Button>
                <Button onClick={() => downloadQR(showQR)} className="flex-1">
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Table Form */}
      <AnimatePresence>
        {showForm && (
          <AddTableForm
            onClose={() => setShowForm(false)}
            onSave={() => { setShowForm(false); fetchTables(true); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AddTableForm({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [number, setNumber]     = useState(1);
  const [name, setName]         = useState("Table 1");
  const [capacity, setCapacity] = useState(4);
  const [saving, setSaving]     = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/admin/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number, name, capacity }),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-bold">Add Table</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Table Number</label>
            <input
              type="number"
              value={number}
              onChange={(e) => {
                setNumber(Number(e.target.value));
                setName(`Table ${e.target.value}`);
              }}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Capacity</label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <Button onClick={handleSave} loading={saving} className="w-full">
            Create Table & Generate QR
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}