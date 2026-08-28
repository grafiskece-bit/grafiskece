import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api, { formatIDR } from "@/lib/api";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";

export default function Analytics() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [o, c] = await Promise.all([api.get("/orders"), api.get("/clients")]);
        setOrders(o.data);
        setClients(c.data);
      } catch { toast.error("Gagal memuat"); }
      finally { setLoading(false); }
    })();
  }, []);

  // group revenue by month (last 6)
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("id-ID", { month: "short" }), value: 0 });
  }
  orders.forEach(o => {
    const k = (o.order_date || "").slice(0, 7);
    const m = months.find(x => x.key === k);
    if (m) m.value += o.order_value || 0;
  });

  const byService = {};
  orders.forEach(o => { byService[o.service] = (byService[o.service] || 0) + 1; });
  const serviceData = Object.entries(byService).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const COLORS = ["#E05D3A", "#F2C94C", "#2D8A56", "#4A7C94", "#B8B1A6", "#D93B3B"];

  const statusCount = {};
  clients.forEach(c => { statusCount[c.status] = (statusCount[c.status] || 0) + 1; });
  const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Insight</div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Analitik</h1>
        <p className="text-neutral-500 mt-2">Gambaran performa & tren bisnismu.</p>
      </div>
      {loading ? <div className="text-neutral-500">Memuat...</div> : (
        <>
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
            <h3 className="font-heading font-semibold mb-4">Revenue 6 Bulan Terakhir</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={months}>
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5C5C5C" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#5C5C5C" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Jt`} />
                  <Tooltip formatter={(v) => formatIDR(v)} contentStyle={{ borderRadius: 12, border: "1px solid #E6E4E0" }} />
                  <Bar dataKey="value" fill="#E05D3A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
              <h3 className="font-heading font-semibold mb-4">Layanan Terpopuler</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={serviceData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {serviceData.map((entry, i) => <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
              <h3 className="font-heading font-semibold mb-4">Status Klien</h3>
              <div className="space-y-3">
                {statusData.map((s, i) => {
                  const total = statusData.reduce((a, b) => a + b.value, 0);
                  const pct = total ? (s.value / total * 100) : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between text-sm mb-1"><span className="font-medium">{s.name}</span><span className="text-neutral-500">{s.value}</span></div>
                      <div className="h-2 bg-[#F0EEE9] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
