import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface UserMenuProps {
  producerName?: string;
  businessName?: string | null;
  onLogout: () => void;
}

export default function UserMenu({
  producerName,
  businessName,
  onLogout,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  const initial = producerName?.trim()?.[0]?.toUpperCase();

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`Menú de usuario${producerName ? `: ${producerName}` : ""}`}
        className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-surface"
      >
        <span className="hidden flex-col items-end sm:flex">
          {producerName ? (
            <span className="text-sm font-medium leading-tight text-text-primary">
              {producerName}
            </span>
          ) : null}
          {businessName ? (
            <span className="text-xs leading-tight text-text-secondary">
              {businessName}
            </span>
          ) : null}
        </span>
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white"
        >
          {initial ?? <UserIcon />}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-border bg-card p-2 shadow-lg"
        >
          <div className="border-b border-border px-3 pb-2 pt-1">
            <p className="truncate text-sm font-medium text-text-primary">
              {producerName ?? "Productor"}
            </p>
            {businessName && (
              <p className="truncate text-xs text-text-secondary">
                {businessName}
              </p>
            )}
          </div>
          <div className="space-y-1 pt-2">
            <Link
              to="/perfil"
              onClick={() => setOpen(false)}
              className="flex w-full items-center rounded-lg px-3 py-2.5 text-sm text-text-primary transition-colors hover:bg-surface"
            >
              Mi perfil
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setConfirmLogout(true);
              }}
              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-error-bg hover:text-error"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmLogout}
        title="Cerrar sesión"
        description="Vas a salir de tu cuenta en este dispositivo. Los cambios sin guardar se perderán."
        confirmLabel="Sí, cerrar sesión"
        cancelLabel="Quedarme"
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}

function UserIcon() {
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
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
