import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api, { formatIDR } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Users, MessageSquare, TrendingUp, Sparkles, Clock, Flame, ArrowRight } from "lucide-react";
import ClientCard from "@/components/app/ClientCard";
import ReminderBanner from "@/components/app/ReminderBanner";
import { useAuth } from "@/lib/auth";

const StatCard = ({ label, value, hint, icon: Icon, accent }) => (
  <div className="bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="flex items-start justify-between mb-3">
      <div className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">{label}</div>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accent || "bg-[#F0EEE9] text-[#E05D3A]"}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <div className="font-heading font-bold text-3xl leading-none">{value}</div>
    {hint && <div className="text-xs text-neutral-500 mt-2">{hint}</div>}
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dashboard/summary");
      setSummary(data);
    } catch (e) {
      toast.error("Gagal memuat dasbor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Dasbor</div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Selamat datang kembali, {user?.name?.split(" ")[0]}</h1>
          <p className="text-neutral-500 mt-2 max-w-xl">Berikut daftar klien yang layak kamu hubungi hari ini untuk bangkitkan repeat order.</p>
        </div>
        <Button onClick={() => nav("/rekomendasi")} data-testid="btn-generate-todays-followups" className="rounded-xl h-11 bg-[#E05D3A] hover:bg-[#C74B2A] text-white font-semibold px-5">
          <Sparkles className="w-4 h-4 mr-2" /> Generate Follow-Up Hari Ini
        </Button>
      </div>

      <ReminderBanner />

      {loading ? (
        <div className="text-neutral-500">Memuat data...</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Klien" value={summary.total_clients} icon={Users} />
            <StatCard label="Follow-Up Hari Ini" value={summary.follow_up_today} icon={MessageSquare} accent="bg-[#FEF3EA] text-[#E05D3A]" />
            <StatCard label="Belum Dihubungi" value={summary.never_contacted} icon={Clock} />
            <StatCard label="Klien VIP/High" value={summary.high_value_clients} icon={Flame} accent="bg-[#FEF3EA] text-[#E05D3A]" />
            <StatCard label="Dormant 30+" value={summary.dormant_30} icon={Clock} />
            <StatCard label="Dormant 60+" value={summary.dormant_60} icon={Clock} />
            <StatCard label="Dormant 90+" value={summary.dormant_90} icon={Clock} />
            <StatCard label="Repeat Bulan Ini" value={summary.repeat_this_month} icon={TrendingUp} accent="bg-[#E9F5EE] text-[#2D8A56]" />
          </div>

          <div className="bg-gradient-to-br from-[#1A1A1A] to-[#2A2320] text-white rounded-3xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute inset-0 grain opacity-20"></div>
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Estimasi Peluang</div>
                <div className="font-heading font-bold text-4xl md:text-5xl mt-2">{formatIDR(summary.estimated_potential_revenue)}</div>
                <div className="text-white/60 mt-2 text-sm">Potensi revenue dari klien warm & hot yang siap di-follow up</div>
              </div>
              <Button onClick={() => nav("/rekomendasi")} data-testid="btn-see-recommendations" className="rounded-xl bg-white text-[#1A1A1A] hover:bg-white/90 font-semibold">
                Lihat Rekomendasi <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-bold text-2xl">Follow-Up Hari Ini</h2>
              <button onClick={() => nav("/klien")} data-testid="link-see-all-clients" className="text-sm text-[#E05D3A] font-semibold hover:underline">Lihat semua klien →</button>
            </div>
            {summary.top_clients_today?.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {summary.top_clients_today.map((c) => <ClientCard key={c.id} client={c} />)}
              </div>
            ) : (
              <div className="bg-white border border-dashed border-[#E6E4E0] rounded-2xl p-10 text-center">
                <div className="text-neutral-500">Belum ada klien prioritas. Tambahkan klien dulu untuk mulai.</div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
