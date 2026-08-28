import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatDate } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

export default function FollowUps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/followups");
        setItems(data);
      } catch { toast.error("Gagal memuat"); }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Riwayat</div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Tindak Lanjut</h1>
        <p className="text-neutral-500 mt-2">{items.length} pesan follow-up tercatat.</p>
      </div>

      {loading ? <div className="text-neutral-500">Memuat...</div> : items.length === 0 ? (
        <div className="bg-white border border-dashed border-[#E6E4E0] rounded-2xl p-10 text-center text-neutral-500">Belum ada follow-up. Mulai dari halaman klien untuk mengirim pesan.</div>
      ) : (
        <div className="space-y-3">
          {items.map(f => (
            <div key={f.id} className="bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated" data-testid={`followup-${f.id}`}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <Link to={`/klien/${f.client_id}`} className="font-heading font-semibold hover:text-[#E05D3A]">{f.client_name} <span className="text-xs text-neutral-500 font-normal">· {f.business_name}</span></Link>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{f.channel}</Badge>
                  <Badge className="bg-[#F0EEE9] text-neutral-800 hover:bg-[#F0EEE9] text-[10px]">{f.status}</Badge>
                  <span className="text-xs text-neutral-500">{formatDate(f.created_at)}</span>
                </div>
              </div>
              <p className="text-sm text-neutral-700 whitespace-pre-wrap line-clamp-3">{f.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
