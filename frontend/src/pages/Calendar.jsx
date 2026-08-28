import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api, { formatDate, formatIDR } from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";
import { id as idLocale } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function CalendarPage() {
  const [clients, setClients] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selected, setSelected] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, o] = await Promise.all([api.get("/clients"), api.get("/orders")]);
        setClients(c.data);
        setOrders(o.data);
      } catch { toast.error("Gagal memuat"); }
      finally { setLoading(false); }
    })();
  }, []);

  const followupDays = useMemo(() => clients.filter(c => c.next_follow_up_date).map(c => new Date(c.next_follow_up_date)), [clients]);
  const orderDays = useMemo(() => orders.filter(o => o.order_date).map(o => new Date(o.order_date)), [orders]);
  const selectedIso = selected?.toISOString().slice(0, 10);

  const dayFollowUps = clients.filter(c => (c.next_follow_up_date || "").slice(0, 10) === selectedIso);
  const dayOrders = orders.filter(o => (o.order_date || "").slice(0, 10) === selectedIso);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Jadwal</div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Kalender</h1>
        <p className="text-neutral-500 mt-2">Jadwal follow-up berikutnya & riwayat order semua klien.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
          <Calendar
            mode="single"
            locale={idLocale}
            selected={selected}
            onSelect={setSelected}
            modifiers={{ followup: followupDays, order: orderDays }}
            modifiersClassNames={{
              followup: "bg-[#FEF3EA] text-[#E05D3A] font-bold",
              order: "underline decoration-[#2D8A56] decoration-2 underline-offset-4",
            }}
          />
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-[#E6E4E0] text-xs">
            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#FEF3EA] border border-[#E05D3A]"></span> Follow-Up</div>
            <div className="flex items-center gap-1.5"><span className="w-3 h-1 rounded bg-[#2D8A56]"></span> Order</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
          <h3 className="font-heading font-semibold mb-4">{selected ? formatDate(selected.toISOString()) : "Pilih tanggal"}</h3>
          <Tabs defaultValue="followups">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="followups" data-testid="tab-followups">Follow-Up ({dayFollowUps.length})</TabsTrigger>
              <TabsTrigger value="orders" data-testid="tab-orders">Order ({dayOrders.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="followups">
              {loading ? <div className="text-neutral-500">Memuat...</div> : dayFollowUps.length === 0 ? (
                <div className="text-sm text-neutral-500 text-center py-6">Tidak ada follow-up dijadwalkan.</div>
              ) : (
                <div className="space-y-2">
                  {dayFollowUps.map(c => (
                    <Link key={c.id} to={`/klien/${c.id}`} data-testid={`cal-fu-${c.id}`} className="block bg-[#F9F8F6] rounded-xl px-4 py-3 hover:bg-[#F0EEE9]">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{c.name}</div>
                          <div className="text-xs text-neutral-500 truncate">{c.business_name}</div>
                        </div>
                        <Badge className="bg-[#FEF3EA] text-[#E05D3A] hover:bg-[#FEF3EA]">Follow-Up</Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="orders">
              {loading ? <div className="text-neutral-500">Memuat...</div> : dayOrders.length === 0 ? (
                <div className="text-sm text-neutral-500 text-center py-6">Tidak ada order pada tanggal ini.</div>
              ) : (
                <div className="space-y-2">
                  {dayOrders.map(o => (
                    <Link key={o.id} to={`/klien/${o.client_id}`} data-testid={`cal-order-${o.id}`} className="block bg-[#F9F8F6] rounded-xl px-4 py-3 hover:bg-[#F0EEE9]">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{o.client_name}</div>
                          <div className="text-xs text-neutral-500 truncate">{o.service}{o.project_name ? ` · ${o.project_name}` : ""}</div>
                        </div>
                        <div className="text-sm font-semibold flex-shrink-0">{formatIDR(o.order_value)}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
