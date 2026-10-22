import type { ReactNode } from "react";

function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function ProductoIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </Icon>
  );
}

export function InsumoIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M6 7h12l1 13H5L6 7z" />
      <path d="M9 7V5a3 3 0 016 0v2" />
    </Icon>
  );
}

export function IngredienteIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15" />
      <path d="M5 19c3-5 6-8 10-10" />
    </Icon>
  );
}

export function QrIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4" />
    </Icon>
  );
}

export function TrazabilidadIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M8.5 6H15a3 3 0 010 6H9a3 3 0 000 6h6.5" />
    </Icon>
  );
}

export function HistorialIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </Icon>
  );
}

export function EtiquetaIcon({ size }: { size?: number }) {
  return (
    <Icon size={size}>
      <path d="M20 13l-7 7-9-9V4h7l9 9z" />
      <circle cx="8" cy="8" r="1.25" />
    </Icon>
  );
}
