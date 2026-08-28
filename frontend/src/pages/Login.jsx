import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Selamat datang kembali!");
      nav("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Gagal masuk");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#F9F8F6]">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-[#1A1A1A] to-[#2A2320] text-white relative overflow-hidden">
        <div className="absolute inset-0 grain opacity-30"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-[#E05D3A] flex items-center justify-center font-heading font-bold text-lg">CR</div>
            <div>
              <div className="font-heading font-bold text-xl">ClientRevive AI</div>
              <div className="text-xs text-white/60">Turn old clients into new opportunities</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="font-heading font-bold text-5xl leading-[1.05]">
            Hidupkan kembali <span className="text-[#E05D3A]">klien lama</span>,<br /> raih repeat order mingguan.
          </h1>
          <p className="text-white/70 text-lg max-w-md leading-relaxed">
            Asisten AI yang tahu siapa yang harus kamu hubungi hari ini, apa yang ditawarkan, dan pesan apa yang mesti dikirim.
          </p>
          <div className="flex gap-4 pt-4">
            <div className="px-4 py-3 bg-white/5 backdrop-blur border border-white/10 rounded-2xl">
              <div className="text-2xl font-heading font-bold text-[#E05D3A]">80+</div>
              <div className="text-xs text-white/60 mt-1">Skor peluang</div>
            </div>
            <div className="px-4 py-3 bg-white/5 backdrop-blur border border-white/10 rounded-2xl">
              <div className="text-2xl font-heading font-bold text-[#E05D3A]">2Jt</div>
              <div className="text-xs text-white/60 mt-1">Target/minggu</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-xs text-white/40">© 2026 ClientRevive AI</div>
      </div>
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="h-10 w-10 rounded-xl bg-[#E05D3A] flex items-center justify-center text-white font-heading font-bold">CR</div>
            <span className="font-heading font-bold text-lg">ClientRevive AI</span>
          </div>
          <h2 className="font-heading font-bold text-3xl mb-2">Masuk ke akunmu</h2>
          <p className="text-neutral-500 mb-8">Lanjutkan pekerjaanmu menghidupkan klien lama.</p>
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" data-testid="input-email" className="h-12 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" data-testid="input-password" className="h-12 rounded-xl" />
            </div>
            <Button type="submit" disabled={loading} data-testid="btn-login" className="w-full h-12 rounded-xl bg-[#E05D3A] hover:bg-[#C74B2A] text-white font-semibold">
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
          <p className="text-sm text-neutral-500 mt-6 text-center">
            Belum punya akun?{" "}
            <Link to="/register" className="text-[#E05D3A] font-semibold hover:underline" data-testid="link-register">Daftar sekarang</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
