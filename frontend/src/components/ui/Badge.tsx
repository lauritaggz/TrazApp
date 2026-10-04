import type { ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "info"
  | "error";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  title?: string;
}

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface text-text-secondary border-border",
  brand: "bg-brand-50 text-accent-strong border-brand-200",
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  info: "bg-info-bg text-info border-info-border",
  error: "bg-error-bg text-error border-error-border",
};

export default function Badge({
  variant = "neutral",
  children,
  className = "",
  title,
}: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
