import React from "react";
import { Link } from "react-router-dom";
import { formatIDR } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Flame, TrendingUp, Clock, Building2 } from "lucide-react";

const scoreColor = (s) => {
  if (s >= 80) return { bg: "bg-[#E05D3A]", text: "text-white", label: "Hot", icon: Flame };
  if (s >= 60) return { bg: "bg-[#F2C94C]", text: "text-neutral-900", label: "Warm", icon: TrendingUp };
  if (s >= 40) return { bg: "bg-[#E9DFCC]", text: "text-neutral-800", label: "Potensial", icon: Clock };
  return { bg: "bg-neutral-200", text: "text-neutral-700", label: "Rendah", icon: Clock };
};

export default function ClientCard({ client }) {
  const s = client.opportunity_score ?? 0;
  const sc = scoreColor(s);
  const Icon = sc.icon;
  return (
    <Link to={`/klien/${client.id}`} data-testid={`client-card-${client.id}`} className="block bg-white rounded-2xl border border-[#E6E4E0] p-5 card-elevated hover:-translate-y-0.5 transition-transform">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="font-heading font-semibold text-[15px] leading-tight truncate">{client.name}</div>
          <div className="text-xs text-neutral-500 mt-0.5 truncate flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {client.business_name || "—"}
          </div>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${sc.bg} ${sc.text} text-[11px] font-semibold whitespace-nowrap`}>
          <Icon className="w-3 h-3" /> {s}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-dashed border-[#E6E4E0]">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Layanan Terakhir</div>
          <div className="text-xs font-medium mt-0.5 truncate">{client.last_service || "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Total Spend</div>
          <div className="text-xs font-medium mt-0.5">{formatIDR(client.total_spending || 0)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Terakhir Order</div>
          <div className="text-xs font-medium mt-0.5">{client.days_since_last_order != null ? `${client.days_since_last_order} hari lalu` : "—"}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">Status</div>
          <div className="text-xs font-medium mt-0.5">
            <Badge variant="secondary" className="rounded-md text-[10px] font-medium">{client.status}</Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
