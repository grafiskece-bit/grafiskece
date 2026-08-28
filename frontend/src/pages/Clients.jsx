import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import ClientCard from "@/components/app/ClientCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Upload, RefreshCw } from "lucide-react";

const FILTERS = [
  { key: "all", label: "Semua" },
  { key: "30", label: "30+ Hari" },
  { key: "60", label: "60+ Hari" },
  { key: "90", label: "90+ Hari" },
  { key: "vip", label: "VIP" },
  { key: "hot", label: "Peluang Tinggi" },
  { key: "never", label: "Belum Dihubungi" },
];

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", business_name: "", whatsapp: "", email: "", instagram: "", business_category: "", location: "", notes: "", status: "Aktif" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/clients");
      setClients(data);
    } catch { toast.error("Gagal memuat klien"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let arr = [...clients];
    if (q) {
      const qq = q.toLowerCase();
      arr = arr.filter(c => (c.name || "").toLowerCase().includes(qq) || (c.business_name || "").toLowerCase().includes(qq) || (c.business_category || "").toLowerCase().includes(qq));
    }
    if (filter === "30") arr = arr.filter(c => (c.days_since_last_order ?? 0) >= 30);
    if (filter === "60") arr = arr.filter(c => (c.days_since_last_order ?? 0) >= 60);
    if (filter === "90") arr = arr.filter(c => (c.days_since_last_order ?? 0) >= 90);
    if (filter === "vip") arr = arr.filter(c => c.status === "VIP");
    if (filter === "hot") arr = arr.filter(c => (c.opportunity_score ?? 0) >= 60);
    if (filter === "never") arr = arr.filter(c => !c.last_follow_up_date);
    arr.sort((a, b) => (b.opportunity_score || 0) - (a.opportunity_score || 0));
    return arr;
  }, [clients, q, filter]);

  const submit = async () => {
    if (!form.name) return toast.error("Nama klien wajib");
    setSaving(true);
    try {
      await api.post("/clients", form);
      toast.success("Klien berhasil ditambahkan");
      setOpen(false);
      setForm({ name: "", business_name: "", whatsapp: "", email: "", instagram: "", business_category: "", location: "", notes: "", status: "Aktif" });
      load();
    } catch (e) { toast.error("Gagal menambahkan klien"); }
    finally { setSaving(false); }
  };

  const onCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/import/csv", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`${data.imported} klien berhasil di-import`);
      load();
    } catch { toast.error("Gagal import CSV"); }
    e.target.value = "";
  };

  const reseed = async () => {
    if (!window.confirm("Reset data klien ke sampel awal? Ini akan menghapus data klien saat ini.")) return;
    try {
      await api.post("/seed-sample-data");
      toast.success("Data sampel di-reset");
      load();
    } catch { toast.error("Gagal reset data"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Database</div>
          <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Klien</h1>
          <p className="text-neutral-500 mt-2">{clients.length} klien total · {filtered.length} ditampilkan</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex">
            <input type="file" accept=".csv" onChange={onCsv} className="hidden" data-testid="input-csv" />
            <Button asChild variant="outline" className="rounded-xl h-10 cursor-pointer"><span><Upload className="w-4 h-4 mr-2" /> Import CSV</span></Button>
          </label>
          <Button variant="outline" onClick={reseed} data-testid="btn-reseed" className="rounded-xl h-10"><RefreshCw className="w-4 h-4 mr-2" /> Reset Sampel</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-client" className="rounded-xl h-10 bg-[#E05D3A] hover:bg-[#C74B2A] text-white"><Plus className="w-4 h-4 mr-2" /> Tambah Klien</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Tambah Klien Baru</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5"><Label>Nama *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-client-name" /></div>
                <div className="col-span-2 space-y-1.5"><Label>Bisnis</Label><Input value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} data-testid="input-client-business" /></div>
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="628xxx" data-testid="input-client-wa" /></div>
                <div className="space-y-1.5"><Label>Instagram</Label><Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} data-testid="input-client-ig" /></div>
                <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Lokasi</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Kategori Bisnis</Label><Input value={form.business_category} onChange={(e) => setForm({ ...form, business_category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Aktif", "Dormant", "Potensial", "VIP", "Lost", "Baru"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5"><Label>Catatan</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={submit} disabled={saving} data-testid="btn-submit-client" className="bg-[#E05D3A] hover:bg-[#C74B2A]">{saving ? "Menyimpan..." : "Simpan"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, bisnis, kategori..." className="pl-10 h-11 rounded-xl bg-white" data-testid="input-search" />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} data-testid={`filter-${f.key}`} className={`h-11 px-4 rounded-xl text-sm font-medium transition-colors ${filter === f.key ? "bg-[#E05D3A] text-white" : "bg-white border border-[#E6E4E0] text-neutral-700 hover:bg-[#F0EEE9]"}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-neutral-500">Memuat...</div> : (
        filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-[#E6E4E0] rounded-2xl p-10 text-center text-neutral-500">Tidak ada klien yang cocok.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(c => <ClientCard key={c.id} client={c} />)}
          </div>
        )
      )}
    </div>
  );
}
