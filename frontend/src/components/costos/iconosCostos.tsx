/** Iconos de la calculadora de costos (trazo de 2 px, heredan el color del texto). */

interface IconoProps {
  size?: number;
}

function Base({ size, children }: IconoProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function InfoIcon({ size = 17 }: IconoProps) {
  return (
    <Base size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </Base>
  );
}

export function CheckIcon({ size = 14 }: IconoProps) {
  return (
    <Base size={size}>
      <polyline points="20 6 9 17 4 12" />
    </Base>
  );
}

export function AlertIcon({ size = 14 }: IconoProps) {
  return (
    <Base size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Base>
  );
}

export function PlusIcon({ size = 14 }: IconoProps) {
  return (
    <Base size={size}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Base>
  );
}

export function TrashIcon({ size = 16 }: IconoProps) {
  return (
    <Base size={size}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6m3 0V4h8v2" />
    </Base>
  );
}

export function LockIcon({ size = 14 }: IconoProps) {
  return (
    <Base size={size}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </Base>
  );
}

export function ProductoIcon({ size = 20 }: IconoProps) {
  return (
    <Base size={size}>
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </Base>
  );
}
