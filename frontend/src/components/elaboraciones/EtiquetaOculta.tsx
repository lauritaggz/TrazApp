import Badge from "@/components/ui/Badge";

/**
 * «Oculta al público» (HU09, CA7): informative. A hidden elaboración stays fully visible to its
 * productor, in the history and in the detail; only the consumers do not see it.
 */
export default function EtiquetaOculta() {
  return (
    <Badge variant="neutral" title="Los consumidores no ven esta elaboración">
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mr-1"
      >
        <path d="M17.9 17.9A10 10 0 0112 20c-7 0-11-8-11-8a18 18 0 015-5.9M9.9 4.2A9 9 0 0112 4c7 0 11 8 11 8a18 18 0 01-2.2 3.2" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
      Oculta al público
    </Badge>
  );
}
