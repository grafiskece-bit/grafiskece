import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatIDR, formatDate } from "@/lib/api";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/orders");
        setOrders(data);
      } catch { toast.error("Gagal memuat"); }
      finally { setLoading(false); }
    })();
  }, []);

  const total = orders.reduce((a, o) => a + (o.order_value || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Riwayat</div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Pesanan</h1>
        <p className="text-neutral-500 mt-2">{orders.length} pesanan · Total {formatIDR(total)}</p>
      </div>
      {loading ? <div className="text-neutral-500">Memuat...</div> : (
        <div className="bg-white rounded-2xl border border-[#E6E4E0] overflow-hidden card-elevated">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F9F8F6] text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold text-neutral-600 text-xs uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 font-semibold text-neutral-600 text-xs uppercase tracking-wider">Klien</th>
                  <th className="px-4 py-3 font-semibold text-neutral-600 text-xs uppercase tracking-wider">Layanan</th>
                  <th className="px-4 py-3 font-semibold text-neutral-600 text-xs uppercase tracking-wider text-right">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => (
                  <tr key={o.id} className="border-t border-[#E6E4E0]" data-testid={`order-row-${o.id}`}>
                    <td className="px-4 py-3">{formatDate(o.order_date)}</td>
                    <td className="px-4 py-3"><Link to={`/klien/${o.client_id}`} className="font-medium hover:text-[#E05D3A]">{o.client_name || "—"}</Link><div className="text-xs text-neutral-500">{o.business_name}</div></td>
                    <td className="px-4 py-3">{o.service}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatIDR(o.order_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
