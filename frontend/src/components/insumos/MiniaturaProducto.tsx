import { useState } from "react";
import { nombreFuente } from "@/lib/fuentesInsumo";

interface MiniaturaProductoProps {
  /** Address of the picture, as the source gave it. Without it (or if it fails to load) a neutral space stays. */
  src: string | null | undefined;
  /** The product's name: the picture's description. */
  nombre: string;
  /** The source of the picture (shown next to it as attribution). */
  fuente: string;
  /** Side in px (48 to 64). */
  tamano?: number;
  /** Show the attribution under the picture. Off when the screen already says it in its own way. */
  atribucion?: boolean;
  /**
   * Classes for the size of the box, when it changes with the screen (the list of hits). They replace the fixed
   * `tamano` box; `tamano` is then only the intrinsic size of the picture (width and height attributes).
   */
  clase?: string;
}

/**
 * Thumbnail of a product that a source found (HU07). Only the address is used: the page never keeps the
 * picture. It loads lazily; if there is no address or the picture fails, a neutral box of the same size
 * stays, so the layout does not move and there is no broken-image icon. The source is named beside it.
 */
export default function MiniaturaProducto({
  src,
  nombre,
  fuente,
  tamano = 56,
  atribucion = true,
  clase,
}: MiniaturaProductoProps) {
  const [fallo, setFallo] = useState<string | null>(null);
  // A new address gets a new chance: the failure belongs to the address that failed.
  const mostrar = Boolean(src) && fallo !== src;

  return (
    <div
      className={clase ? "flex shrink-0 flex-col items-center gap-1 lg:w-full" : "flex shrink-0 flex-col items-center gap-1"}
      style={clase ? undefined : { width: Math.max(tamano, 72) }}
    >
      <div
        data-miniatura-producto
        className={`overflow-hidden rounded-lg border border-border bg-surface ${clase ?? ""}`}
        style={clase ? undefined : { width: tamano, height: tamano }}
      >
        {mostrar && (
          <img
            src={src ?? undefined}
            alt={nombre}
            width={tamano}
            height={tamano}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-contain"
            onError={() => setFallo(src ?? null)}
          />
        )}
      </div>
      {mostrar && atribucion && (
        <span className="text-center text-xs leading-tight text-text-secondary">Imagen: {nombreFuente(fuente)}</span>
      )}
    </div>
  );
}
