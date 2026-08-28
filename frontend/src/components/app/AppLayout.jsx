import React, { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, MessageSquare, Sparkles, ShoppingBag, CalendarDays, BarChart3, Settings as SettingsIcon, Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const nav = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/klien", label: "Klien", icon: Users, testid: "nav-clients" },
  { to: "/tindak-lanjut", label: "Tindak Lanjut", icon: MessageSquare, testid: "nav-followups" },
  { to: "/rekomendasi", label: "Rekomendasi AI", icon: Sparkles, testid: "nav-recommendations" },
  { to: "/pesanan", label: "Pesanan", icon: ShoppingBag, testid: "nav-orders" },
  { to: "/kalender", label: "Kalender", icon: CalendarDays, testid: "nav-calendar" },
  { to: "/analitik", label: "Analitik", icon: BarChart3, testid: "nav-analytics" },
  { to: "/pengaturan", label: "Pengaturan", icon: SettingsIcon, testid: "nav-settings" },
];

function SidebarContent({ onNav }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-8 pb-6">
        <Link to="/" onClick={onNav} className="flex items-center gap-2" data-testid="brand-logo">
          <div className="h-9 w-9 rounded-xl bg-[#E05D3A] flex items-center justify-center text-white font-bold font-heading">CR</div>
          <div>
            <div className="font-heading font-bold text-[17px] leading-none">ClientRevive</div>
            <div className="text-[11px] text-neutral-500 mt-1">AI Assistant</div>
          </div>
        </Link>
      </div>
      <nav className="px-3 flex-1 space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={onNav}
            data-testid={item.testid}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#E05D3A] text-white shadow-sm"
                  : "text-neutral-700 hover:bg-[#F0EEE9]"
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-[#E6E4E0]">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="h-9 w-9 rounded-full bg-[#F0EEE9] flex items-center justify-center text-[#E05D3A] font-semibold text-sm" data-testid="user-avatar">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-[11px] text-neutral-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="p-2 rounded-lg hover:bg-[#F0EEE9] text-neutral-500 hover:text-[#E05D3A] transition-colors"
            data-testid="btn-logout"
            aria-label="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-[#F9F8F6]">
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-white border-b border-[#E6E4E0]">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-[#E05D3A] flex items-center justify-center text-white font-bold text-sm font-heading">CR</div>
          <span className="font-heading font-bold">ClientRevive</span>
        </Link>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" data-testid="btn-open-sidebar"><Menu className="w-5 h-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SidebarContent onNav={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop layout */}
      <div className="md:flex">
        <aside className="hidden md:flex md:flex-col md:w-72 md:h-screen md:sticky md:top-0 bg-white border-r border-[#E6E4E0]">
          <SidebarContent />
        </aside>
        <main className="flex-1 min-w-0">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
