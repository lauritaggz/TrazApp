const base = {
  width: 21,
  height: 21,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function IconoOjoTachado() {
  return (
    <svg {...base}>
      <path d="M17.9 17.9A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.9" />
      <path d="M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

export function IconoCalendarioTachado() {
  return (
    <svg {...base}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
      <line x1="9" y1="15" x2="15" y2="19" />
      <line x1="15" y1="15" x2="9" y2="19" />
    </svg>
  );
}

export function IconoCalendario() {
  return (
    <svg {...base} width={17} height={17}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <line x1="16" y1="3" x2="16" y2="7" />
      <line x1="8" y1="3" x2="8" y2="7" />
      <line x1="3" y1="11" x2="21" y2="11" />
    </svg>
  );
}

export function IconoAlerta() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export function IconoInfo() {
  return (
    <svg {...base} width={16} height={16}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="11" x2="12" y2="16" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function IconoProductor() {
  return (
    <svg {...base} width={16} height={16}>
      <path d="M3 21h18" />
      <path d="M6 21V8l6-4 6 4v13" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}
