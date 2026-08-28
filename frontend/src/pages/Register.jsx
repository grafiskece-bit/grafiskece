import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success("Akun berhasil dibuat! Data sampel sudah disiapkan.");
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal mendaftar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#F9F8F6]">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center gap-2 justify-center">
          <div className="h-11 w-11 rounded-2xl bg-[#E05D3A] flex items-center justify-center text-white font-heading font-bold">CR</div>
          <div>
            <div className="font-heading font-bold text-lg">ClientRevive AI</div>
            <div className="text-xs text-neutral-500">Turn old clients into new opportunities</div>
          </div>
        </Link>
        <div className="bg-white rounded-3xl border border-[#E6E4E0] p-8 card-elevated">
          <h2 className="font-heading font-bold text-3xl mb-2">Buat akun baru</h2>
          <p className="text-neutral-500 mb-6 text-sm">15 data klien sampel akan disiapkan untuk kamu langsung coba.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama</Label>
              <Input id="name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama kamu" data-testid="input-name" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" data-testid="input-email" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Minimal 6 karakter" data-testid="input-password" className="h-12 rounded-xl" />
            </div>
            <Button type="submit" disabled={loading} data-testid="btn-register" className="w-full h-12 rounded-xl bg-[#E05D3A] hover:bg-[#C74B2A] text-white font-semibold">
              {loading ? "Membuat akun..." : "Daftar Sekarang"}
            </Button>
          </form>
          <p className="text-sm text-neutral-500 mt-6 text-center">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-[#E05D3A] font-semibold hover:underline" data-testid="link-login">Masuk</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
