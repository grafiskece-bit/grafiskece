import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";

const STATUS = ["Aktif", "Dormant", "Potensial", "VIP", "Lost", "Baru"];
const FOLLOWUP_STATUS = ["Belum Dihubungi", "Sudah Dihubungi", "Dibalas", "Tertarik", "Negosiasi", "Konversi", "Tidak Tertarik", "Follow Up Nanti"];
const PRIORITY = ["Tinggi", "Sedang", "Rendah"];
const CHANNELS = ["WhatsApp", "Email", "Instagram", "Telepon"];

export default function EditClientDialog({ client, open, onOpenChange, onSaved }) {
  const [f, setF] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  useEffect(() => {
    if (client && open) {
      setF({
        name: client.name || "",
        business_name: client.business_name || "",
        whatsapp: client.whatsapp || "",
        email: client.email || "",
        instagram: client.instagram || "",
        business_category: client.business_category || "",
        location: client.location || "",
        notes: client.notes || "",
        status: client.status || "Aktif",
        follow_up_status: client.follow_up_status || "Belum Dihubungi",
        priority: client.priority || "Sedang",
        preferred_channel: client.preferred_channel || "WhatsApp",
        tags: (client.tags || []).join(", "),
        next_follow_up_date: client.next_follow_up_date ? client.next_follow_up_date.slice(0, 10) : "",
        opportunity_score_override: client.opportunity_score_override ?? "",
      });
    }
  }, [client, open]);

  if (!f) return null;

  const save = async () => {
    setSaving(true);
    try {
      const rawOverride = f.opportunity_score_override;
      const payload = {
        ...f,
        tags: f.tags ? f.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        opportunity_score_override: rawOverride === "" || rawOverride === null ? null : Number(rawOverride),
        next_follow_up_date: f.next_follow_up_date || null,
      };
      await api.patch(`/clients/${client.id}`, payload);
      toast.success("Klien diperbarui");
      onSaved?.();
      onOpenChange(false);
    } catch (e) { toast.error("Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  const nextDate = f.next_follow_up_date ? new Date(f.next_follow_up_date) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Edit Klien</DialogTitle>
            <DialogClose asChild>
              <button data-testid="btn-close-edit" className="p-1.5 rounded-lg hover:bg-[#F0EEE9] text-neutral-500" aria-label="Tutup"><X className="w-4 h-4" /></button>
            </DialogClose>
          </div>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Nama *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="edit-name" /></div>
          <div className="space-y-1.5"><Label>Nama Bisnis</Label><Input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} data-testid="edit-business" /></div>
          <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="628xxx" data-testid="edit-whatsapp" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="edit-email" /></div>
          <div className="space-y-1.5"><Label>Instagram</Label><Input value={f.instagram} onChange={(e) => setF({ ...f, instagram: e.target.value })} data-testid="edit-instagram" /></div>
          <div className="space-y-1.5"><Label>Kategori Bisnis</Label><Input value={f.business_category} onChange={(e) => setF({ ...f, business_category: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Lokasi</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Channel Utama</Label>
            <Select value={f.preferred_channel} onValueChange={(v) => setF({ ...f, preferred_channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHANNELS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Status Klien</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger data-testid="edit-status"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Status Follow-Up</Label>
            <Select value={f.follow_up_status} onValueChange={(v) => setF({ ...f, follow_up_status: v })}>
              <SelectTrigger data-testid="edit-follow-status"><SelectValue /></SelectTrigger>
              <SelectContent>{FOLLOWUP_STATUS.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Prioritas</Label>
            <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
              <SelectTrigger data-testid="edit-priority"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITY.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Skor Peluang Manual (0-100, kosongkan untuk otomatis)</Label><Input type="number" min="0" max="100" value={f.opportunity_score_override} onChange={(e) => setF({ ...f, opportunity_score_override: e.target.value })} data-testid="edit-score" placeholder="Otomatis" /></div>
          <div className="space-y-1.5"><Label>Follow-Up Berikutnya</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start rounded-md font-normal" data-testid="edit-nextdate"><CalendarIcon className="w-4 h-4 mr-2" />{f.next_follow_up_date || "Pilih tanggal"}</Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" locale={idLocale} selected={nextDate} onSelect={(d) => { setF({ ...f, next_follow_up_date: d ? d.toISOString().slice(0, 10) : "" }); setDateOpen(false); }} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5 md:col-span-2"><Label>Tags (pisah koma)</Label><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="loyal, hemat, cepat-respon" /></div>
          <div className="space-y-1.5 md:col-span-2"><Label>Catatan</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3} /></div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild><Button variant="outline" data-testid="btn-cancel-edit">Batal</Button></DialogClose>
          <Button onClick={save} disabled={saving} data-testid="btn-save-edit" className="bg-[#E05D3A] hover:bg-[#C74B2A] text-white">{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
