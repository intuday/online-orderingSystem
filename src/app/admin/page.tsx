"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, ShoppingBag, DollarSign, Users, Utensils,
  Clock, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  totalRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  todayOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  totalCustomers: number;
  activeTables: number;
  totalTables: number;
  popularItems: Array<{ id: string; name: string; orderCount: number; price: number; image: string | null }>;
  recentOrders: Array<{ id: string; orderNumber: string; customerName: string | null; total: number; status: string | null; createdAt: Date }>;
  chartData: Array<{ date: string; orders: number; revenue: number }>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const statCards = [
    {
      label: "Today's Revenue",
      value: formatCurrency(data.todayRevenue),
      icon: DollarSign,
      color: "from-green-400 to-emerald-500",
      bgColor: "bg-green-50",
      textColor: "text-green-700",
    },
    {
      label: "Today's Orders",
      value: data.todayOrders.toString(),
      icon: ShoppingBag,
      color: "from-blue-400 to-indigo-500",
      bgColor: "bg-blue-50",
      textColor: "text-blue-700",
    },
    {
      label: "Pending Orders",
      value: data.pendingOrders.toString(),
      icon: Clock,
      color: "from-amber-400 to-orange-500",
      bgColor: "bg-amber-50",
      textColor: "text-amber-700",
    },
    {
      label: "Total Customers",
      value: data.totalCustomers.toString(),
      icon: Users,
      color: "from-purple-400 to-violet-500",
      bgColor: "bg-purple-50",
      textColor: "text-purple-700",
    },
  ];

  const statusColor: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    preparing: "bg-blue-100 text-blue-700",
    ready: "bg-green-100 text-green-700",
    served: "bg-slate-100 text-slate-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back! Here&apos;s what&apos;s happening today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, idx) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white rounded-2xl p-4 shadow-card"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 shadow-card">
          <p className="text-xs text-slate-500">Total Revenue</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatCurrency(data.totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card">
          <p className="text-xs text-slate-500">Total Orders</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.totalOrders}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card">
          <p className="text-xs text-slate-500">Preparing Now</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.preparingOrders}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-card">
          <p className="text-xs text-slate-500">Active Tables</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{data.activeTables}/{data.totalTables}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Revenue (Last 7 Days)</h3>
          <div className="h-48 flex items-end gap-2">
            {data.chartData.map((d, i) => {
              const maxRev = Math.max(...data.chartData.map((c) => c.revenue), 1);
              const h = (d.revenue / maxRev) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-slate-500 font-medium">{formatCurrency(d.revenue)}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(h, 4)}%` }}
                    transition={{ delay: i * 0.05, duration: 0.5 }}
                    className="w-full bg-gradient-to-t from-orange-500 to-amber-400 rounded-t-lg min-h-[4px]"
                  />
                  <span className="text-[10px] text-slate-400">{d.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Items */}
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Popular Items</h3>
          <div className="space-y-3">
            {data.popularItems.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">
                  {idx + 1}
                </span>
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-lg">🍽️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400">{item.orderCount} orders</p>
                </div>
                <span className="text-sm font-semibold text-slate-900">{formatCurrency(item.price)}</span>
              </div>
            ))}
            {data.popularItems.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-2xl p-5 shadow-card">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Order</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Customer</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Amount</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Status</th>
                <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-slate-900">{order.orderNumber}</td>
                  <td className="py-3 px-3 text-slate-600">{order.customerName || "Guest"}</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{formatCurrency(order.total)}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase ${statusColor[order.status || "pending"] || "bg-slate-100 text-slate-600"}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
              {data.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">No orders yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
