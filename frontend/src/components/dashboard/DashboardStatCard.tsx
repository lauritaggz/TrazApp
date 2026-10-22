import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  loading?: boolean;
  /** The card takes the productor to what the number is about (HT07). */
  to?: string;
  /** «positivo»: nothing to do (for example, no supply with allergens to review). */
  tono?: "normal" | "positivo";
}

export default function DashboardStatCard({
  label,
  value,
  icon,
  loading = false,
  to,
  tono = "normal",
}: DashboardStatCardProps) {
  const positivo = tono === "positivo" && !loading;
  const contenido = (
    <>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:mb-3 ${
          positivo ? "bg-success-bg text-success" : "bg-brand-50 text-accent"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={`mb-0.5 text-2xl font-bold ${positivo ? "text-success" : ""}`}
          aria-live={loading ? "polite" : undefined}
        >
          {loading ? "—" : value}
        </p>
        <p className="text-xs leading-snug text-text-secondary">{label}</p>
      </div>
    </>
  );
  // Phone: icon and number side by side (a short row); from sm: the card as before.
  const clases =
    "flex items-center gap-3 rounded-xl border border-border bg-card p-4 sm:block";
  if (!to) return <div className={clases}>{contenido}</div>;
  return (
    <Link
      to={to}
      className={`${clases} min-h-11 transition-colors hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`}
    >
      {contenido}
    </Link>
  );
}
