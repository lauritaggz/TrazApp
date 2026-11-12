import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/** The amber notice of the tracing: elaboraciones that cannot be ruled out. Text, plus an optional link. */
export default function AvisoAmbar({
  children,
  enlace,
}: {
  children: ReactNode;
  enlace?: { to: string; texto: string };
}) {
  return (
    <div
      role="status"
      data-aviso-ambar
      className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-bg px-3.5 py-3 text-sm text-warning"
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
      >
        <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="min-w-0 flex-1 font-medium">
        <p>{children}</p>
        {enlace && (
          <Link
            to={enlace.to}
            className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {enlace.texto}
          </Link>
        )}
      </div>
    </div>
  );
}
