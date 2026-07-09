"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, DollarSign, ShoppingBag, Users,
  CheckCircle, XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ReportData {
  summary: {
    totalRevenue:    number;
    totalOrders:     number;
    completedOrders: number;
    cancelledOrders: number;
    avgOrderValue:   number;
    totalCustomers:  number;
  };
  ordersByStatus: Record<string, number>;
  paymentStats:   { paid: number; unpaid: number };
  topItems: Array<{ id: string; name: string; price: number; orderCount: number; revenue: number }>;
  chartData: Array<{ date: string; orders: number; revenue: number }>;
  period: string;
}

const DEFAULT_DATA: ReportData = {
  summary: {
    totalRevenue:    0,
    totalOrders:     0,
    completedOrders: 0,
    cancelledOrders: 0,
    avgOrderValue:   0,
    totalCustomers:  0,
  },
  ordersByStatus: {},
  paymentStats:   { paid: 0, unpaid: 0 },
  topItems:       [],
  chartData:      [],
  period:         "weekly",
};

export default function ReportsPage() {
  const [data, setData]       = useState<ReportData>(DEFAULT_DATA);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<"daily" | "weekly" | "monthly">("weekly");

  // ✅ useCallback - pehle declare, phir useEffect mein use
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reports?period=${period}`);
      const d   = await res.json();
      if (d && d.summary) {
        setData(d);
      } else {
        setData(DEFAULT_DATA);
      }
    } catch {
      setData(DEFAULT_DATA);
    } finally {
      setLoading(false);
    }
  }, [period]); // ✅ period dependency

  // ✅ fetchReports ab declared hai
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const completionRate = data.summary.totalOrders > 0
    ? Math.round((data.summary.completedOrders / data.summary.totalOrders) * 100)
    : 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">Business performance insights</p>
        </div>
        <div className="flex gap-2">
          {(["daily", "weekly", "monthly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                period === p
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 border border-slate-200"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: DollarSign,  color: "green",  value: formatCurrency(data.summary.totalRevenue),  label: "Total Revenue" },
          { icon: ShoppingBag, color: "blue",   value: data.summary.totalOrders,                   label: "Total Orders" },
          { icon: TrendingUp,  color: "orange", value: formatCurrency(data.summary.avgOrderValue), label: "Avg Order Value" },
          { icon: Users,       color: "purple", value: data.summary.totalCustomers,                label: "Total Customers" },
        ].map(({ icon: Icon, color, value, label }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl p-5 shadow-card"
          >
            <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 text-${color}-600`} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Order Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Completion Ring */}
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Order Completion</h3>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 shrink-0">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="48" cy="48" r="40" fill="none" stroke="#22c55e" strokeWidth="8"
                  strokeDasharray={`${completionRate * 2.51} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-slate-900">{completionRate}%</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-slate-600">{data.summary.completedOrders} completed</span>
              </div>
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-slate-600">{data.summary.cancelledOrders} cancelled</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Stats */}
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Payment Status</h3>
          <div className="space-y-3">
            {[
              { label: "Paid",   value: data.paymentStats.paid,   barColor: "bg-green-500",  textColor: "text-green-600" },
              { label: "Unpaid", value: data.paymentStats.unpaid, barColor: "bg-amber-500",  textColor: "text-amber-600" },
            ].map(({ label, value, barColor, textColor }) => (
              <div key={label}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-slate-600">{label}</span>
                  <span className={`font-semibold ${textColor}`}>{value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded-full transition-all`}
                    style={{
                      width: `${data.summary.totalOrders > 0
                        ? (value / data.summary.totalOrders) * 100
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Orders By Status */}
        <div className="bg-white rounded-2xl p-5 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Order Status</h3>
          {Object.keys(data.ordersByStatus).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(data.ordersByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 capitalize">{status}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">No orders yet</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-6">Revenue Trend</h3>
          {data.chartData.length > 0 ? (
            <div className="h-52 flex items-end gap-2">
              {data.chartData.map((d, i) => {
                const maxRev = Math.max(...data.chartData.map(c => c.revenue), 1);
                const h = (d.revenue / maxRev) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-400">{formatCurrency(d.revenue)}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(h, 4)}%` }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="w-full bg-linear-to-t from-orange-500 to-amber-400 rounded-t-lg min-h-1"
                    />
                    <span className="text-[10px] text-slate-400">{d.date}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">
              No data available
            </div>
          )}
        </div>

        {/* Orders Chart */}
        <div className="bg-white rounded-2xl p-6 shadow-card">
          <h3 className="text-sm font-bold text-slate-900 mb-6">Orders Trend</h3>
          {data.chartData.length > 0 ? (
            <div className="h-52 flex items-end gap-2">
              {data.chartData.map((d, i) => {
                const maxOrd = Math.max(...data.chartData.map(c => c.orders), 1);
                const h = (d.orders / maxOrd) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-slate-400">{d.orders}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(h, 4)}%` }}
                      transition={{ delay: i * 0.08, duration: 0.5 }}
                      className="w-full bg-linear-to-t from-blue-500 to-cyan-400 rounded-t-lg min-h-1"
                    />
                    <span className="text-[10px] text-slate-400">{d.date}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-sm text-slate-400">
              No data available
            </div>
          )}
        </div>
      </div>

      {/* Top Items Table */}
      <div className="bg-white rounded-2xl p-6 shadow-card">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Top Selling Items</h3>
        {data.topItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Item</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Price</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Orders</th>
                  <th className="text-left py-2 px-3 text-xs text-slate-500 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.topItems.map((item, idx) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-3 font-bold text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-3 font-medium text-slate-900">{item.name}</td>
                    <td className="py-3 px-3 text-slate-600">{formatCurrency(item.price)}</td>
                    <td className="py-3 px-3 font-semibold text-slate-900">{item.orderCount}</td>
                    <td className="py-3 px-3 font-semibold text-green-600">{formatCurrency(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-sm text-slate-400">No items sold yet</p>
        )}
      </div>

    </div>
  );
}