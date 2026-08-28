import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatDate } from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";
import { id as idLocale } from "date-fns/locale";

export default function CalendarPage() {
  const [clients, setClients] = useState([]);
  const [selected, setSelected] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/clients");
        setClients(data);
      } catch { toast.error("Gagal memuat"); }
      finally { setLoading(false); }
    })();
  }, []);

  const withFollowUp = clients.filter(c => c.next_follow_up_date);
  const daysWithEvents = withFollowUp.map(c => new Date(c.next_follow_up_date));
  const selectedIso = selected?.toISOString().slice(0, 10);
  const daysList = withFollowUp.filter(c => c.next_follow_up_date?.slice(0, 10) === selectedIso);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Jadwal</div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Kalender Follow-Up</h1>
        <p className="text-neutral-500 mt-2">Jadwal follow-up berikutnya untuk setiap klien.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
          <Calendar mode="single" selected={selected} onSelect={setSelected} locale={idLocale} modifiers={{ event: daysWithEvents }} modifiersClassNames={{ event: "bg-[#FEF3EA] text-[#E05D3A] font-bold" }} />
        </div>
        <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
          <h3 className="font-heading font-semibold mb-4">{selected ? formatDate(selected.toISOString()) : "Pilih tanggal"}</h3>
          {loading ? <div className="text-neutral-500">Memuat...</div> : daysList.length === 0 ? (
            <div className="text-sm text-neutral-500">Tidak ada follow-up dijadwalkan.</div>
          ) : (
            <div className="space-y-2">
              {daysList.map(c => (
                <Link key={c.id} to={`/klien/${c.id}`} data-testid={`cal-item-${c.id}`} className="block bg-[#F9F8F6] rounded-xl px-4 py-3 hover:bg-[#F0EEE9]">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-neutral-500">{c.business_name}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
