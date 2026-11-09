import { Link } from "react-router-dom";
import DeshabilitarPublicacionDialog from "@/components/publicaciones/DeshabilitarPublicacionDialog";
import { AlertIcon, CheckIcon, FlechaIcon } from "@/components/publicaciones/iconos";
import PublicacionSwitch from "@/components/publicaciones/PublicacionSwitch";
import { RequisitosFaltantes, rutaDeRequisito } from "@/components/publicaciones/Requisitos";
import PublicacionBadge from "@/components/products/PublicacionBadge";
import Alert from "@/components/ui/Alert";
import { usePublicacionProducto } from "@/hooks/usePublicacionProducto";
import type { Product } from "@/types/product";

interface PublicacionFilaProps {
  product: Product;
  onChange: (cambios: Partial<Product>) => void;
  onNotFound: () => void;
}

export function textoElaboraciones(finalizadas: number): string {
  return `${finalizadas} ${finalizadas === 1 ? "elaboración finalizada" : "elaboraciones finalizadas"}`;
}

/** A product ready to be published: a formulation and at least one finalized elaboración. */
export function estaListo(product: Product): boolean {
  return product.tiene_formulacion === true && (product.elaboraciones_finalizadas ?? 0) > 0;
}

/** One product of the general view: state, what it still needs, the switch and «Gestionar». */
export default function PublicacionFila({ product, onChange, onNotFound }: PublicacionFilaProps) {
  const publicacion = usePublicacionProducto({ productoId: product.id, onChange, onNotFound });
  const publicado = product.publicado === true;
  const listo = estaListo(product);
  const finalizadas = product.elaboraciones_finalizadas ?? 0;
  const bloqueado = !publicado && !listo;

  return (
    <li className="space-y-3 px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-primary">{product.nombre}</p>
            <PublicacionBadge publicado={publicado} />
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
            {product.codigo_interno ?? "—"}
            <span aria-hidden="true"> · </span>
            {textoElaboraciones(finalizadas)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 text-[13px]">
          <Indicador
            cumple={product.tiene_formulacion === true}
            etiqueta="Formulación"
            textoFalta="Falta la formulación: defínela"
            to={rutaDeRequisito("sin_formulacion", product.id)}
          />
          <Indicador
            cumple={finalizadas > 0}
            etiqueta="Elaboración"
            textoFalta="Falta una elaboración finalizada: regístrala"
            to={rutaDeRequisito("sin_elaboracion_finalizada", product.id)}
          />
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <PublicacionSwitch
            checked={publicado}
            disabled={bloqueado || publicacion.busy}
            label={publicado ? `Deshabilitar publicación de ${product.nombre}` : `Habilitar publicación de ${product.nombre}`}
            title={bloqueado ? "Completa los requisitos para habilitar la publicación" : undefined}
            onChange={(siguiente) => (siguiente ? void publicacion.habilitar() : publicacion.pedirDeshabilitar())}
          />
          <Link
            to={`/publicaciones/${product.id}`}
            aria-label={`Gestionar ${product.nombre}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-text-primary hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Gestionar
            <FlechaIcon />
          </Link>
        </div>
      </div>

      {publicacion.faltantes.length > 0 && (
        <RequisitosFaltantes faltantes={publicacion.faltantes} productoId={product.id} />
      )}
      {publicacion.error && (
        <Alert type="error">
          <p>{publicacion.error}</p>
        </Alert>
      )}

      <DeshabilitarPublicacionDialog
        open={publicacion.confirmando}
        loading={publicacion.busy}
        onConfirm={() => void publicacion.confirmarDeshabilitar()}
        onCancel={publicacion.cancelarDeshabilitar}
      />
    </li>
  );
}

function Indicador({
  cumple,
  etiqueta,
  textoFalta,
  to,
}: {
  cumple: boolean;
  etiqueta: string;
  textoFalta: string;
  to: string;
}) {
  if (cumple) {
    return (
      <span className="inline-flex min-h-11 items-center gap-1.5 text-success">
        <CheckIcon />
        {etiqueta}
        <span className="sr-only">: lista</span>
      </span>
    );
  }
  return (
    <Link
      to={to}
      aria-label={textoFalta}
      className="inline-flex min-h-11 items-center gap-1.5 font-medium text-warning underline underline-offset-2 hover:no-underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <AlertIcon />
      {etiqueta}
    </Link>
  );
}
