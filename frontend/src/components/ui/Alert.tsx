import type { ReactNode } from "react";

interface AlertProps {
  type: "error" | "success";
  children: ReactNode;
}

export default function Alert({ type, children }: AlertProps) {
  const styles = {
    error: "bg-error-bg border-error-border text-error",
    success: "bg-success-bg border-success-border text-success",
  };

  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium ${styles[type]}`}
    >
      {type === "error" ? <AlertErrorIcon /> : <AlertSuccessIcon />}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function AlertErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 mt-0.5"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function AlertSuccessIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 mt-0.5"
    >
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
