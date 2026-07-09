"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Phone, Mail, ShoppingBag,
  ChevronRight, X, Clock, TrendingUp,
  IndianRupee, Calendar, Package, Star,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrderItem {
  menuItemId: string;
  name:       string;
  price:      number;
  quantity:   number;
  variant?:   string;
  image?:     string;
}

interface CustomerOrder {
  id:            string;
  orderNumber:   string;
  items:         OrderItem[] | string;
  subtotal:      number;
  total:         number;
  discount:      number;
  status:        string;
  paymentStatus: string;
  createdAt:     any;
  notes?:        string;
  couponCode?:   string;
}

interface Customer {
  id:               string;
  name:             string;
  email?:           string | null;
  phone?:           string | null;
  totalOrders:      number;
  totalSpent:       number;
  lastOrderAt?:     any;
  lastOrderStatus?: string;
  orders:           CustomerOrder[];
  createdAt?:       any;
  source?:          string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getTimestamp(ts: any): number {
  if (!ts) return 0;
  if (ts._seconds) return ts._seconds * 1000;
  if (ts.seconds)  return ts.seconds  * 1000;
  if (typeof ts === "string") return new Date(ts).getTime();
  if (typeof ts === "number") return ts > 1e12 ? ts : ts * 1000;
  return 0;
}

function timeAgo(ts: any): string {
  const ms   = getTimestamp(ts);
  if (!ms) return "—";
  const diff  = Date.now() - ms;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1)  return "Just now";
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  if (days  < 30)  return `${Math.floor(days / 7)}w ago`;
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "2-digit",
  });
}

function formatDateTime(ts: any): string {
  const ms = getTimestamp(ts);
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function parseItems(items: OrderItem[] | string): OrderItem[] {
  if (Array.isArray(items)) return items;
  if (typeof items === "string") {
    try { return JSON.parse(items); } catch { return []; }
  }
  return [];
}

const statusColors: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-indigo-100 text-indigo-700",
  ready:     "bg-green-100 text-green-700",
  served:    "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-100 text-slate-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

// ─── OrderItemsList - Expandable ──────────────────────────────────────────────
function OrderItemsList({ items }: { items: OrderItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const visibleCount = 3;
  const hasMore      = items.length > visibleCount;
  const displayItems = expanded ? items : items.slice(0, visibleCount);

  return (
    <div className="text-xs text-slate-600 leading-relaxed">
      {displayItems.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="text-slate-300 mx-1">•</span>}
          <span className="font-medium text-slate-700">{item.quantity}×</span>{" "}
          {item.name}
          {item.variant && (
            <span className="text-slate-400 text-[10px]"> ({item.variant})</span>
          )}
        </span>
      ))}

      {/* ✅ Clickable "+N more" button */}
      {hasMore && !expanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          className="ml-1 text-orange-500 font-semibold hover:text-orange-600 underline underline-offset-2 transition-colors text-xs"
        >
          +{items.length - visibleCount} more
        </button>
      )}

      {/* ✅ Collapse button */}
      {hasMore && expanded && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          className="ml-1 text-slate-400 font-medium hover:text-slate-600 underline underline-offset-2 transition-colors text-xs"
        >
          show less
        </button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const [customers, setCustomers]               = useState<Customer[]>([]);
  const [loading, setLoading]                   = useState(true);
  const [search, setSearch]                     = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [sortBy, setSortBy]                     = useState<"recent" | "orders" | "spent">("recent");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/customers");
      const data = await res.json();
      setCustomers(data.customers || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers
    .filter((c: Customer) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (c.name  || "").toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q)
      );
    })
    .sort((a: Customer, b: Customer) => {
      if (sortBy === "orders") return b.totalOrders - a.totalOrders;
      if (sortBy === "spent")  return b.totalSpent  - a.totalSpent;
      return getTimestamp(b.lastOrderAt) - getTimestamp(a.lastOrderAt);
    });

  const totalCustomers = customers.length;
  const totalRevenue   = customers.reduce((s, c) => s + c.totalSpent, 0);
  const totalOrders    = customers.reduce((s, c) => s + c.totalOrders, 0);
  const avgOrderValue  = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-1">{totalCustomers} total customers</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, email..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: Users,       color: "blue",   value: totalCustomers,            label: "Total Customers" },
          { icon: ShoppingBag, color: "orange", value: totalOrders,               label: "Total Orders" },
          { icon: IndianRupee, color: "green",  value: formatCurrency(totalRevenue), label: "Total Revenue" },
          { icon: TrendingUp,  color: "purple", value: formatCurrency(avgOrderValue), label: "Avg Order" },
        ].map(({ icon: Icon, color, value, label }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-card">
            <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Sort Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "recent" as const, label: "Recent Activity" },
          { key: "orders" as const, label: "Most Orders" },
          { key: "spent"  as const, label: "Highest Spent" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSortBy(tab.key)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
              sortBy === tab.key
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Customer Cards */}
      <div className="grid gap-3">
        {filtered.map((customer: Customer, idx: number) => (
          <motion.div
            key={customer.id || idx}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.03 }}
            onClick={() => setSelectedCustomer(customer)}
            className="bg-white rounded-2xl p-4 shadow-card hover:shadow-elevated transition-all cursor-pointer border border-transparent hover:border-orange-200 group"
          >
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
                {(customer.name || "?").charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-slate-900">{customer.name || "Unknown"}</h3>
                  {customer.source === "guest" && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">GUEST</span>
                  )}
                  {customer.totalOrders >= 10 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" /> VIP
                    </span>
                  )}
                  {customer.totalOrders >= 5 && customer.totalOrders < 10 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-0.5">
                      <Star className="w-2.5 h-2.5" /> REGULAR
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {customer.phone && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {customer.phone}
                    </span>
                  )}
                  {customer.email && (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {customer.email}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <Package className="w-3 h-3 text-blue-500" />
                    <span className="font-bold">{customer.totalOrders}</span> orders
                  </span>
                  <span className="text-xs text-slate-600 flex items-center gap-1">
                    <IndianRupee className="w-3 h-3 text-green-500" />
                    <span className="font-bold">{formatCurrency(customer.totalSpent)}</span> spent
                  </span>
                  {customer.lastOrderAt && (
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(customer.lastOrderAt)}
                    </span>
                  )}
                  {customer.lastOrderStatus && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                      statusColors[customer.lastOrderStatus] || "bg-slate-100 text-slate-500"
                    }`}>
                      {customer.lastOrderStatus}
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-orange-500 transition-colors shrink-0" />
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">No customers found</p>
          <p className="text-xs text-slate-400 mt-1">Customers will appear here when they place orders</p>
        </div>
      )}

      <AnimatePresence>
        {selectedCustomer && (
          <CustomerDetailModal
            customer={selectedCustomer}
            onClose={() => setSelectedCustomer(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Customer Detail Modal ────────────────────────────────────────────────────
function CustomerDetailModal({
  customer,
  onClose,
}: {
  customer: Customer;
  onClose:  () => void;
}) {
  const sortedOrders = [...(customer.orders || [])].sort((a, b) =>
    getTimestamp(b.createdAt) - getTimestamp(a.createdAt)
  );

  const avgOrder = customer.totalOrders > 0
    ? customer.totalSpent / customer.totalOrders
    : 0;

  // Favorite items
  const itemCounts: Record<string, { name: string; count: number }> = {};
  sortedOrders.forEach((order) => {
    parseItems(order.items).forEach((item) => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, count: 0 };
      itemCounts[item.name].count += item.quantity;
    });
  });
  const favoriteItems = Object.values(itemCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const firstOrderDate = sortedOrders.length > 0
    ? formatDateTime(sortedOrders[sortedOrders.length - 1]?.createdAt)
    : "—";
  const lastOrderDate = sortedOrders.length > 0
    ? formatDateTime(sortedOrders[0]?.createdAt)
    : "—";

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
        className="w-full max-w-lg bg-white rounded-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
              {(customer.name || "?").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{customer.name || "Unknown"}</h2>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {customer.phone && (
                  <span className="text-white/80 text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="text-white/80 text-xs flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {customer.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {customer.source === "guest" && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">GUEST</span>
                )}
                {customer.totalOrders >= 5 && customer.totalOrders < 10 && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5" /> REGULAR CUSTOMER
                  </span>
                )}
                {customer.totalOrders >= 10 && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 flex items-center gap-0.5">
                    <Star className="w-2.5 h-2.5" /> VIP CUSTOMER
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 p-5">
            <div className="bg-blue-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{customer.totalOrders}</p>
              <p className="text-[10px] text-blue-600 font-medium mt-0.5">Total Orders</p>
            </div>
            <div className="bg-green-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-green-700">{formatCurrency(customer.totalSpent)}</p>
              <p className="text-[10px] text-green-600 font-medium mt-0.5">Total Spent</p>
            </div>
            <div className="bg-purple-50 rounded-2xl p-3 text-center">
              <p className="text-xl font-bold text-purple-700">{formatCurrency(avgOrder)}</p>
              <p className="text-[10px] text-purple-600 font-medium mt-0.5">Avg Order</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="px-5 pb-4">
            <div className="bg-slate-50 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> First Order
                </span>
                <span className="text-slate-700 font-medium">{firstOrderDate}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> Last Order
                </span>
                <span className="text-slate-700 font-medium">{lastOrderDate}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <ArrowUpRight className="w-3 h-3" /> Last Activity
                </span>
                <span className="text-slate-700 font-medium">{timeAgo(customer.lastOrderAt)}</span>
              </div>
            </div>
          </div>

          {/* Favorite Items */}
          {favoriteItems.length > 0 && (
            <div className="px-5 pb-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <Star className="w-4 h-4 text-amber-500" /> Favorite Items
              </h3>
              <div className="flex flex-wrap gap-2">
                {favoriteItems.map((item) => (
                  <span
                    key={item.name}
                    className="bg-orange-50 border border-orange-100 text-orange-700 text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {item.name} × {item.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Order History */}
          <div className="px-5 pb-5">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-blue-500" />
              Order History ({sortedOrders.length})
            </h3>

            {sortedOrders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedOrders.map((order, idx) => {
                  const items       = parseItems(order.items);
                  const statusColor = statusColors[order.status] || "bg-slate-100 text-slate-500";

                  return (
                    <motion.div
                      key={order.id || idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100"
                    >
                      {/* Order Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 font-mono">
                            {order.orderNumber || `#${idx + 1}`}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${statusColor}`}>
                            {order.status}
                          </span>
                          {order.paymentStatus === "paid" && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                              PAID
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-900">
                          {formatCurrency(order.total || 0)}
                        </span>
                      </div>

                      {/* ✅ Expandable Order Items */}
                      <OrderItemsList items={items} />

                      {/* Order Footer */}
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDateTime(order.createdAt)}
                        </span>
                        <div className="flex items-center gap-2">
                          {(order.discount || 0) > 0 && (
                            <span className="text-[10px] text-green-600 font-medium">
                              Saved {formatCurrency(order.discount)}
                            </span>
                          )}
                          {order.couponCode && (
                            <span className="text-[9px] bg-orange-50 text-orange-600 font-bold px-1.5 py-0.5 rounded-full border border-orange-100">
                              🎟️ {order.couponCode}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <p className="text-[10px] text-amber-700 italic bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">
                          📝 {order.notes}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}