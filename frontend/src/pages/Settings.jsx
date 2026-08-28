import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TONES = ["Ramah", "Kasual", "Profesional", "Hangat", "Sales", "Soft Selling"];

export default function Settings() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await api.get("/settings");
      setS({
        business_name: data.business_name || "",
        business_description: data.business_description || "",
        whatsapp_number: data.whatsapp_number || "",
        ai_tone: data.ai_tone || "Ramah",
        currency: data.currency || "Rp",
        services: data.services || [],
        pricing: data.pricing || {},
        follow_up_intervals: data.follow_up_intervals || [7, 14, 30, 60, 90],
        fonnte_token: data.fonnte_token || "",
        reminder_time: data.reminder_time || "08:00",
      });
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", s);
      toast.success("Pengaturan tersimpan");
    } catch { toast.error("Gagal menyimpan"); }
    finally { setSaving(false); }
  };

  if (!s) return <div className="text-neutral-500">Memuat...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A]">Preferensi</div>
        <h1 className="font-heading font-bold text-3xl md:text-4xl mt-2">Pengaturan</h1>
        <p className="text-neutral-500 mt-2">AI akan pakai data ini untuk generate rekomendasi & pesan.</p>
      </div>
      <div className="bg-white rounded-2xl border border-[#E6E4E0] p-6 card-elevated space-y-5">
        <div><Label>Nama Bisnis / Freelancer</Label><Input value={s.business_name} onChange={(e) => setS({ ...s, business_name: e.target.value })} className="mt-1.5 rounded-xl h-11" data-testid="input-biz-name" /></div>
        <div><Label>Deskripsi Bisnis</Label><Textarea value={s.business_description} onChange={(e) => setS({ ...s, business_description: e.target.value })} className="mt-1.5 rounded-xl" data-testid="textarea-biz-desc" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nomor WhatsApp</Label><Input value={s.whatsapp_number} onChange={(e) => setS({ ...s, whatsapp_number: e.target.value })} placeholder="628xxx" className="mt-1.5 rounded-xl h-11" /></div>
          <div><Label>Mata Uang</Label><Input value={s.currency} onChange={(e) => setS({ ...s, currency: e.target.value })} className="mt-1.5 rounded-xl h-11" /></div>
        </div>
        <div><Label>Tone AI Default</Label>
          <Select value={s.ai_tone} onValueChange={(v) => setS({ ...s, ai_tone: v })}>
            <SelectTrigger className="mt-1.5 rounded-xl h-11" data-testid="select-tone-default"><SelectValue /></SelectTrigger>
            <SelectContent>{TONES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Layanan yang Ditawarkan (pisah koma)</Label>
          <Input value={s.services.join(", ")} onChange={(e) => setS({ ...s, services: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} className="mt-1.5 rounded-xl h-11" data-testid="input-services" />
        </div>
        <div><Label>Interval Follow-Up (hari, pisah koma)</Label>
          <Input value={s.follow_up_intervals.join(", ")} onChange={(e) => setS({ ...s, follow_up_intervals: e.target.value.split(",").map(x => parseInt(x.trim())).filter(Boolean) })} className="mt-1.5 rounded-xl h-11" />
        </div>
        <div className="pt-4 border-t border-[#E6E4E0]">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#E05D3A] mb-3">Integrasi WhatsApp Business</div>
          <Label>Fonnte Device Token</Label>
          <Input value={s.fonnte_token} onChange={(e) => setS({ ...s, fonnte_token: e.target.value })} placeholder="Paste token dari dashboard Fonnte" className="mt-1.5 rounded-xl h-11" data-testid="input-fonnte-token" type="password" />
          <p className="text-xs text-neutral-500 mt-2">Kalau token diisi, pesan akan dikirim otomatis via Fonnte (support jadwal). Kalau kosong, tombol Kirim WhatsApp akan buka wa.me.</p>
        </div>
        <div>
          <Label>Waktu Pengingat Harian</Label>
          <Input type="time" value={s.reminder_time} onChange={(e) => setS({ ...s, reminder_time: e.target.value })} className="mt-1.5 rounded-xl h-11 w-40" data-testid="input-reminder-time" />
          <p className="text-xs text-neutral-500 mt-2">Waktu banner pengingat muncul di dasbor. Notifikasi browser aktif setelah kamu izinkan sekali.</p>
        </div>
        <Button onClick={save} disabled={saving} data-testid="btn-save-settings" className="rounded-xl bg-[#E05D3A] hover:bg-[#C74B2A] text-white">{saving ? "Menyimpan..." : "Simpan Perubahan"}</Button>
      </div>
    </div>
  );
}
