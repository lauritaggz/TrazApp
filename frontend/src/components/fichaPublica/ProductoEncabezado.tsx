import { useState } from "react";
import { IconoProductor } from "@/components/fichaPublica/iconosPublicos";
import { formatearContenidoNeto, lineaDeProducto } from "@/lib/fichaPublicaFormato";
import { resolveProductImageUrl } from "@/lib/productImageUpload";
import type { ProductoPublico } from "@/types/consultaPublica";

function imagenDelProducto(imagenUrl: string | null): string | null {
  try {
    return resolveProductImageUrl(imagenUrl);
  } catch {
    return null;
  }
}

/** Product identity of the public ficha: image (if any), category and content, name and maker. */
export default function ProductoEncabezado({ producto }: { producto: ProductoPublico }) {
  const [imagenFallida, setImagenFallida] = useState(false);
  const imagen = imagenFallida ? null : imagenDelProducto(producto.imagen_url);
  const linea = lineaDeProducto(
    producto.categorias,
    formatearContenidoNeto(producto.contenido_neto, producto.unidad_medida),
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {imagen && (
        <div className="aspect-[16/10] bg-border sm:aspect-[16/7]">
          <img
            src={imagen}
            alt={producto.nombre}
            className="h-full w-full object-cover"
            onError={() => setImagenFallida(true)}
          />
        </div>
      )}
      <div className="p-5 sm:p-6">
        {linea && <p className="mb-1.5 text-sm font-medium text-accent">{linea}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">{producto.nombre}</h1>
        {producto.elaborado_por && (
          <div className="mt-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-accent">
              <IconoProductor />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-text-muted">Elaborado por</p>
              <p className="text-sm font-medium text-text-primary">{producto.elaborado_por}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
