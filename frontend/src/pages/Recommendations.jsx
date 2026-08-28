import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatIDR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Flame, TrendingUp, RefreshCw } from "lucide-react";

export default function Recommendations() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ai/recommendations");
      setData(data);
    } catch { toast.error("Gagal memuat rekomendasi"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Rekomendasi AI</div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Apa yang Harus Dijual Hari Ini?</h1>
          <p className="text-neutral-500 mt-2">Top 10 klien prioritas beserta layanan dan tawaran yang paling relevan.</p>
        </div>
        <Button variant="outline" onClick={load} data-testid="btn-refresh-recs" className="rounded-xl"><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Klien Prioritas</div>
            <div className="font-heading font-bold text-3xl mt-2">{data.revenue_estimate.clients_count}</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Estimasi Hari Ini</div>
            <div className="font-heading font-bold text-3xl mt-2">{formatIDR(data.revenue_estimate.daily_potential)}</div>
            <div className="text-xs text-neutral-500 mt-1">Konversi {(data.revenue_estimate.conversion_rate * 100).toFixed(0)}%</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Potensi Minggu Ini</div>
            <div className="font-heading font-bold text-3xl mt-2">{formatIDR(data.revenue_estimate.weekly_potential)}</div>
            <div className="text-xs text-neutral-500 mt-1">*Estimasi</div>
          </div>
        </div>
      )}

      {loading ? <div className="text-neutral-500">Memuat...</div> : (
        <div className="space-y-3">
          {data?.top_clients?.map((c, idx) => {
            const s = c.opportunity_score;
            const Icon = s >= 80 ? Flame : TrendingUp;
            const badgeClr = s >= 80 ? "bg-[#E05D3A] text-white" : s >= 60 ? "bg-[#F2C94C] text-neutral-900" : "bg-[#E9DFCC] text-neutral-800";
            return (
              <Link to={`/klien/${c.id}`} key={c.id} data-testid={`rec-${c.id}`} className="block bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated hover:border-[#E05D3A] transition-colors">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                  <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-[#F0EEE9] flex items-center justify-center font-heading font-bold text-lg text-neutral-700">#{idx + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-heading font-semibold text-lg">{c.name}</div>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeClr}`}><Icon className="w-3 h-3" /> {s}/100</div>
                    </div>
                    <div className="text-xs text-neutral-500 mt-0.5">{c.business_name || "—"}</div>
                    <p className="text-sm text-neutral-700 mt-2"><span className="font-semibold">Kenapa:</span> {c.reason}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                      <div className="bg-[#F9F8F6] rounded-lg px-3 py-2">
                        <div className="text-[10px] uppercase text-neutral-500 font-bold">Jual</div>
                        <div className="text-sm font-semibold">{c.recommended_service}</div>
                      </div>
                      <div className="bg-[#F9F8F6] rounded-lg px-3 py-2">
                        <div className="text-[10px] uppercase text-neutral-500 font-bold">Tawaran</div>
                        <div className="text-sm font-semibold">{c.recommended_offer}</div>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-neutral-400 flex-shrink-0 hidden md:block" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
