import type { ReactNode } from "react";

function Svg({ size = 14, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function CheckIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <polyline points="20 6 9 17 4 12" />
    </Svg>
  );
}

export function AlertIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </Svg>
  );
}

export function FlechaIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <polyline points="9 18 15 12 9 6" />
    </Svg>
  );
}

export function GlobeIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
    </Svg>
  );
}

export function EyeIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function ShieldIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </Svg>
  );
}
