import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import api, { formatIDR, formatDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarUi } from "@/components/ui/calendar";
import { id as idLocale } from "date-fns/locale";
import { ArrowLeft, Sparkles, Copy, Send, RefreshCw, Type, Instagram, MapPin, Phone, Building2, Trash2, Plus, Pencil, Calendar as CalendarIcon, X } from "lucide-react";
import EditClientDialog from "@/components/app/EditClientDialog";

const TONES = ["Ramah", "Kasual", "Profesional", "Hangat", "Sales", "Soft Selling"];

function ScoreRing({ score }) {
  const pct = Math.max(0, Math.min(100, score || 0));
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? "#E05D3A" : pct >= 60 ? "#F2C94C" : pct >= 40 ? "#B8B1A6" : "#D9D5CF";
  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#F0EEE9" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${circ - dash}`} className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-heading font-bold text-3xl">{pct}</div>
        <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Peluang</div>
      </div>
    </div>
  );
}

export default function ClientProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const [client, setClient] = useState(null);
  const [ai, setAi] = useState(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState("Ramah");
  const [genLoading, setGenLoading] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [orderDateOpen, setOrderDateOpen] = useState(false);
  const [order, setOrder] = useState({ order_date: new Date().toISOString().slice(0, 10), service: "", project_name: "", order_value: 0, notes: "" });

  const load = async () => {
    try {
      const { data } = await api.get(`/clients/${id}`);
      setClient(data);
    } catch { toast.error("Klien tidak ditemukan"); nav("/klien"); }
  };
  const analyze = async () => {
    setAnalyzeLoading(true);
    try {
      const { data } = await api.get(`/ai/analyze/${id}`);
      setAi(data);
    } catch { toast.error("AI analysis gagal"); }
    finally { setAnalyzeLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { if (client) analyze(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [client?.id]);

  const generate = async (modifier = null) => {
    setGenLoading(true);
    try {
      const { data } = await api.post("/ai/generate-message", { client_id: id, tone, modifier, previous_message: message });
      setMessage(data.message);
    } catch { toast.error("Gagal generate pesan"); }
    finally { setGenLoading(false); }
  };

  const copyMsg = async () => {
    if (!message) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const ta = document.createElement("textarea");
        ta.value = message; document.body.appendChild(ta); ta.select();
        document.execCommand("copy"); document.body.removeChild(ta);
      }
      toast.success("Pesan disalin");
    } catch (e) {
      toast.error("Tidak bisa menyalin. Salin manual dari textarea.");
    }
  };

  const openWA = async () => {
    if (!client?.whatsapp) return toast.error("Nomor WhatsApp belum diisi");
    if (!message) return toast.error("Generate pesan dulu");
    try {
      const { data } = await api.post("/whatsapp/send", { client_id: id, message });
      if (data.sent) {
        toast.success("Pesan terkirim via Fonnte ✓");
        load();
        return;
      }
      // fallback: wa.me
      await api.post("/followups", { client_id: id, message, channel: "WhatsApp", status: "Terkirim" });
      load();
      window.open(data.wa_link, "_blank");
    } catch (e) {
      const msg = e?.response?.data?.detail || "Gagal kirim WhatsApp";
      toast.error(typeof msg === "string" ? msg : "Gagal kirim");
    }
  };

  const saveFollowUp = async () => {
    if (!message) return toast.error("Pesan kosong");
    try {
      await api.post("/followups", { client_id: id, message, channel: "Manual", status: "Terkirim" });
      toast.success("Tindak lanjut tercatat");
      load();
    } catch { toast.error("Gagal menyimpan"); }
  };

  const addOrder = async () => {
    if (!order.service || !order.order_date) return toast.error("Isi tanggal & layanan");
    try {
      await api.post(`/clients/${id}/orders`, { ...order, order_value: Number(order.order_value) });
      toast.success("Pesanan tersimpan");
      setOrderOpen(false);
      setOrder({ order_date: new Date().toISOString().slice(0, 10), service: "", project_name: "", order_value: 0, notes: "" });
      load();
      analyze();
    } catch { toast.error("Gagal simpan pesanan"); }
  };

  const deleteOrder = async (oid) => {
    if (!window.confirm("Hapus pesanan ini?")) return;
    await api.delete(`/orders/${oid}`);
    load();
  };

  const deleteClient = async () => {
    if (!window.confirm("Hapus klien ini beserta seluruh datanya?")) return;
    await api.delete(`/clients/${id}`);
    toast.success("Klien dihapus");
    nav("/klien");
  };

  if (!client) return <div className="text-neutral-500">Memuat...</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => nav(-1)} className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900" data-testid="btn-back"><ArrowLeft className="w-4 h-4" /> Kembali</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: profile & AI */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="font-heading font-bold text-2xl md:text-3xl">{client.name}</h1>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-500">
                  {client.business_name && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {client.business_name}</span>}
                  {client.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {client.location}</span>}
                  {client.whatsapp && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {client.whatsapp}</span>}
                  {client.instagram && <span className="inline-flex items-center gap-1"><Instagram className="w-3.5 h-3.5" /> {client.instagram}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className="bg-[#F0EEE9] text-neutral-800 hover:bg-[#F0EEE9]">{client.status}</Badge>
                  {client.business_category && <Badge variant="outline">{client.business_category}</Badge>}
                  {client.priority && <Badge variant="outline">Prioritas: {client.priority}</Badge>}
                  {client.tags?.map(t => <Badge key={t} className="bg-[#FEF3EA] text-[#E05D3A] hover:bg-[#FEF3EA] rounded-md" data-testid={`tag-${t}`}>#{t}</Badge>)}
                </div>
                {client.notes && <p className="mt-4 text-sm text-neutral-600 italic">"{client.notes}"</p>}
              </div>
              <button onClick={deleteClient} data-testid="btn-delete-client" className="p-2 rounded-lg text-neutral-400 hover:text-[#D93B3B] hover:bg-red-50" aria-label="Hapus klien"><Trash2 className="w-4 h-4" /></button>
              <button onClick={() => setEditOpen(true)} data-testid="btn-edit-client" className="p-2 rounded-lg text-neutral-500 hover:text-[#E05D3A] hover:bg-[#F0EEE9]" aria-label="Edit klien"><Pencil className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#E6E4E0]">
              <div><div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Total Order</div><div className="font-heading font-bold text-xl mt-1">{client.orders_count}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Total Spend</div><div className="font-heading font-bold text-xl mt-1">{formatIDR(client.total_spending)}</div></div>
              <div><div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Terakhir Order</div><div className="font-heading font-bold text-xl mt-1">{client.days_since_last_order != null ? `${client.days_since_last_order}h` : "—"}</div></div>
            </div>
          </div>

          {/* AI analysis */}
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#E05D3A]" />
                <h3 className="font-heading font-semibold text-lg">Client Revival AI</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={analyze} disabled={analyzeLoading} data-testid="btn-refresh-analysis"><RefreshCw className="w-3.5 h-3.5" /></Button>
            </div>
            {analyzeLoading ? <div className="text-sm text-neutral-500">Menganalisis...</div> : ai ? (
              <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-shrink-0 flex flex-col items-center">
                  <ScoreRing score={ai.score} />
                  <div className="mt-2 text-xs font-semibold text-[#E05D3A]">{ai.category}</div>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-bold">Analisis</div>
                    <p className="text-sm text-neutral-700 mt-1 leading-relaxed">{ai.analysis}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    <div className="bg-[#F9F8F6] rounded-xl p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Layanan</div><div className="text-sm font-semibold mt-1">{ai.recommended_service}</div></div>
                    <div className="bg-[#F9F8F6] rounded-xl p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Tawaran</div><div className="text-sm font-semibold mt-1">{ai.recommended_offer}</div></div>
                    <div className="bg-[#F9F8F6] rounded-xl p-3"><div className="text-[10px] uppercase tracking-wider text-neutral-500 font-bold">Timing</div><div className="text-sm font-semibold mt-1">{ai.recommended_timing}</div></div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* AI Message Generator */}
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold text-lg">Generate Pesan Follow-Up</h3>
              <div className="w-40">
                <Select value={tone} onValueChange={setTone}>
                  <SelectTrigger data-testid="select-tone"><SelectValue placeholder="Tone" /></SelectTrigger>
                  <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Klik 'Generate' untuk membuat pesan AI, atau tulis sendiri di sini..." className="min-h-[180px] rounded-xl" data-testid="textarea-message" />
            <div className="flex flex-wrap gap-2 mt-3">
              <Button onClick={() => generate()} disabled={genLoading} data-testid="btn-generate" className="rounded-xl bg-[#E05D3A] hover:bg-[#C74B2A] text-white"><Sparkles className="w-4 h-4 mr-2" /> {genLoading ? "Generating..." : "Generate"}</Button>
              <Button variant="outline" onClick={() => generate("regenerate")} disabled={genLoading || !message} data-testid="btn-regen" className="rounded-xl"><RefreshCw className="w-4 h-4 mr-2" /> Ulangi</Button>
              <Button variant="outline" onClick={() => generate("shorter")} disabled={genLoading || !message} className="rounded-xl">Persingkat</Button>
              <Button variant="outline" onClick={() => generate("more_casual")} disabled={genLoading || !message} className="rounded-xl"><Type className="w-4 h-4 mr-2" /> Kasual</Button>
              <Button variant="outline" onClick={() => generate("more_professional")} disabled={genLoading || !message} className="rounded-xl">Profesional</Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={copyMsg} disabled={!message} data-testid="btn-copy" className="rounded-xl"><Copy className="w-4 h-4 mr-2" /> Salin</Button>
              <Button onClick={openWA} disabled={!message || !client.whatsapp} data-testid="btn-whatsapp" className="rounded-xl bg-[#25D366] hover:bg-[#1EBE5A] text-white"><Send className="w-4 h-4 mr-2" /> Kirim WhatsApp</Button>
              <Button variant="outline" onClick={saveFollowUp} disabled={!message} data-testid="btn-save-followup" className="rounded-xl">Catat Manual</Button>
            </div>
          </div>
        </div>

        {/* Right: history */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-semibold">Riwayat Order</h3>
              <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
                <DialogTrigger asChild><Button size="sm" variant="ghost" data-testid="btn-add-order"><Plus className="w-4 h-4" /></Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <div className="flex items-center justify-between">
                      <DialogTitle>Tambah Order</DialogTitle>
                      <DialogClose asChild><button data-testid="btn-close-order" className="p-1.5 rounded-lg hover:bg-[#F0EEE9]" aria-label="Tutup"><X className="w-4 h-4" /></button></DialogClose>
                    </div>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Tanggal</Label>
                      <Popover open={orderDateOpen} onOpenChange={setOrderDateOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal mt-1" data-testid="order-date-picker"><CalendarIcon className="w-4 h-4 mr-2" />{order.order_date || "Pilih tanggal"}</Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarUi mode="single" locale={idLocale} selected={order.order_date ? new Date(order.order_date) : undefined} onSelect={(d) => { setOrder({ ...order, order_date: d ? d.toISOString().slice(0, 10) : "" }); setOrderDateOpen(false); }} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div><Label>Layanan</Label>
                      <Select value={order.service} onValueChange={(v) => setOrder({ ...order, service: v })}>
                        <SelectTrigger className="mt-1" data-testid="order-service"><SelectValue placeholder="Pilih layanan" /></SelectTrigger>
                        <SelectContent>
                          {["Logo Design", "Branding", "Social Media Design", "Instagram Carousel", "Instagram Reels", "Video Editing", "Content Creation", "Wedding Design", "Poster", "Flyer", "Packaging", "Lainnya"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Nama Project</Label><Input value={order.project_name} onChange={(e) => setOrder({ ...order, project_name: e.target.value })} /></div>
                    <div><Label>Nilai (Rp)</Label><Input type="number" value={order.order_value} onChange={(e) => setOrder({ ...order, order_value: e.target.value })} /></div>
                    <div><Label>Catatan</Label><Input value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter><Button onClick={addOrder} data-testid="btn-submit-order" className="bg-[#E05D3A] hover:bg-[#C74B2A]">Simpan</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {client.orders?.length ? (
              <div className="space-y-3">
                {client.orders.map(o => (
                  <div key={o.id} className="flex items-start justify-between gap-3 pb-3 border-b border-dashed border-[#E6E4E0] last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{o.service}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{formatDate(o.order_date)}{o.project_name ? ` · ${o.project_name}` : ""}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-semibold">{formatIDR(o.order_value)}</div>
                      <button onClick={() => deleteOrder(o.id)} className="text-xs text-neutral-400 hover:text-[#D93B3B] mt-1"><Trash2 className="w-3 h-3 inline" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-neutral-500">Belum ada order.</div>}
          </div>

          <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated">
            <h3 className="font-heading font-semibold mb-4">Riwayat Follow-Up</h3>
            {client.followups?.length ? (
              <div className="space-y-4">
                {client.followups.map(f => (
                  <div key={f.id} className="pb-4 border-b border-dashed border-[#E6E4E0] last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1"><Badge variant="outline" className="text-[10px]">{f.channel}</Badge><div className="text-xs text-neutral-500">{formatDate(f.created_at)}</div></div>
                    <p className="text-xs text-neutral-700 line-clamp-3 whitespace-pre-wrap">{f.message}</p>
                  </div>
                ))}
              </div>
            ) : <div className="text-sm text-neutral-500">Belum ada follow-up.</div>}
          </div>
        </div>
      </div>
      <EditClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} onSaved={() => { load(); analyze(); }} />
    </div>
  );
}
