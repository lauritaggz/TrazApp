import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface DashboardStatCardProps {
  label: string;
  value: number | string;
  icon: ReactNode;
  loading?: boolean;
  /** The card takes the productor to what the number is about (HT07). */
  to?: string;
  /**
   * «positivo»: nothing to do (for example, no supply with allergens to review).
   * «alerta»: something waits for the productor (HT08: ámbar, como en el prototipo).
   */
  tono?: "normal" | "positivo" | "alerta";
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
  const alerta = tono === "alerta" && !loading;
  const contenido = (
    <>
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:-rotate-6 sm:mb-4 ${
          positivo
            ? "bg-success-bg text-success"
            : alerta
              ? "bg-card text-warning"
              : "bg-brand-50 text-accent"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className={`font-display text-[1.75rem] leading-none font-bold tabular-nums sm:text-[2rem] ${
            positivo ? "text-success" : alerta ? "text-warning" : "text-text-primary"
          }`}
          aria-live={loading ? "polite" : undefined}
        >
          {loading ? "—" : value}
        </p>
        <p className={`mt-1.5 text-[13px] leading-snug ${alerta ? "text-warning" : "text-text-secondary"}`}>
          {label}
        </p>
      </div>
    </>
  );
  // Phone: icon and number side by side (a short row); from sm: the card as before.
  const clases = `group flex items-center gap-4 rounded-2xl border p-4 sm:block sm:p-5 ${
    alerta ? "border-warning-border bg-warning-bg" : "border-border bg-card"
  }`;
  if (!to) return <div className={clases}>{contenido}</div>;
  return (
    <Link
      to={to}
      className={`${clases} min-h-11 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`}
    >
      {contenido}
    </Link>
  );
}
