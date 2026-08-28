import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { Bell, ArrowRight, X } from "lucide-react";

const KEY = "cr_reminder_dismissed_";

export default function ReminderBanner() {
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [visible, setVisible] = useState(true);

  const today = new Date().toISOString().slice(0, 10);
  const dismissKey = KEY + today;

  useEffect(() => {
    if (localStorage.getItem(dismissKey)) { setVisible(false); return; }
    (async () => {
      try {
        const { data } = await api.get("/reminders/today");
        setData(data);
        // browser notification if permitted
        if ((data?.count || 0) > 0 && "Notification" in window) {
          const shownKey = "cr_notif_shown_" + today;
          if (Notification.permission === "granted" && !localStorage.getItem(shownKey)) {
            new Notification("ClientRevive AI", {
              body: `${data.count} klien perlu di-follow up hari ini`,
              icon: "/favicon.ico",
            });
            localStorage.setItem(shownKey, "1");
          }
        }
      } catch (err) {
        console.error("Failed to load today's reminders:", err);
      }
    })();
  }, [today]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "default") {
      const p = await Notification.requestPermission();
      if (p === "granted") {
        new Notification("ClientRevive AI", { body: "Notifikasi harian aktif ✓" });
      }
    }
  };

  const dismiss = () => {
    localStorage.setItem(dismissKey, "1");
    setVisible(false);
  };

  if (!visible || !data || data.count === 0) return null;

  return (
    <div className="bg-[#FEF3EA] border border-[#F5C9AF] rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4" data-testid="reminder-banner">
      <div className="h-10 w-10 rounded-xl bg-[#E05D3A] text-white flex items-center justify-center flex-shrink-0">
        <Bell className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-heading font-semibold text-[#8A3A1F]">Pengingat Follow-Up Hari Ini</div>
        <div className="text-sm text-neutral-700 mt-1">
          Ada <span className="font-semibold text-[#E05D3A]">{data.count} klien</span> yang perlu kamu hubungi hari ini. Yang paling prioritas: {data.clients.slice(0, 3).map(c => c.name).join(", ")}.
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {"Notification" in window && Notification.permission === "default" && (
          <button onClick={requestPermission} data-testid="btn-enable-notif" className="text-xs text-[#E05D3A] font-semibold underline hover:no-underline">Aktifkan notifikasi</button>
        )}
        <button onClick={() => nav("/rekomendasi")} data-testid="btn-view-reminders" className="inline-flex items-center gap-1 bg-[#E05D3A] hover:bg-[#C74B2A] text-white text-sm font-semibold rounded-xl px-4 py-2">
          Buka Daftar <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button onClick={dismiss} data-testid="btn-dismiss-reminder" className="p-2 rounded-lg text-neutral-500 hover:bg-white" aria-label="Tutup"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
