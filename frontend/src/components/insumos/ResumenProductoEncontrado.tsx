import { useEffect, useRef } from "react";

interface ResumenProductoEncontradoProps {
  resumen: string | undefined;
}

/**
 * Next to the form that a lookup just filled in (HT07): what was found and what was suggested, and the view moves
 * to where the form starts. The form is mounted again with every lookup, so this runs once per lookup.
 */
export default function ResumenProductoEncontrado({ resumen }: ResumenProductoEncontradoProps) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!resumen) return;
    const sinMovimiento =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: sinMovimiento ? "auto" : "smooth", block: "start" });
  }, [resumen]);

  if (!resumen) return null;
  return (
    <p
      ref={ref}
      data-resumen-producto-encontrado
      className="scroll-mt-4 rounded-lg border border-success-border bg-success-bg px-3.5 py-3 text-sm font-medium text-success"
    >
      {resumen}
    </p>
  );
}
