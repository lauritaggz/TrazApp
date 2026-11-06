import { useEffect, useRef } from "react";
import MiniaturaProducto from "@/components/insumos/MiniaturaProducto";

interface ResumenProductoEncontradoProps {
  resumen: string | undefined;
  /** HU07: the product's thumbnail and its source. Shown beside the summary; a neutral space if it has none. */
  imagen?: { url: string | null; fuente: string };
  /** The product's name: the description of the picture. */
  nombreProducto?: string;
}

/**
 * Next to the form that a lookup just filled in (HT07): what was found and what was suggested, and the view moves
 * to where the form starts. The form is mounted again with every lookup, so this runs once per lookup.
 */
export default function ResumenProductoEncontrado({
  resumen,
  imagen,
  nombreProducto,
}: ResumenProductoEncontradoProps) {
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
    <div className="flex items-start gap-3">
      {imagen && (
        <MiniaturaProducto
          src={imagen.url}
          nombre={nombreProducto || "Producto encontrado"}
          fuente={imagen.fuente}
          tamano={64}
        />
      )}
      <p
        ref={ref}
        data-resumen-producto-encontrado
        className="scroll-mt-4 min-w-0 flex-1 rounded-lg border border-success-border bg-success-bg px-3.5 py-3 text-sm font-medium text-success"
      >
        {resumen}
      </p>
    </div>
  );
}
