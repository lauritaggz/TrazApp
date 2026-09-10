import type { ReactNode } from "react";

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  accent: string;
  dim?: boolean;
  loading?: boolean;
}

export default function DashboardStatCard({
  label,
  value,
  icon,
  accent,
  dim = false,
  loading = false,
}: DashboardStatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div
        className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${accent}18`, color: accent }}
      >
        {icon}
      </div>
      <p
        className="mb-0.5 text-2xl font-bold"
        style={{ color: dim ? accent : undefined }}
        aria-live={loading ? "polite" : undefined}
      >
        {loading ? "—" : value}
      </p>
      <p className="text-xs leading-snug text-text-secondary">{label}</p>
    </div>
  );
}
