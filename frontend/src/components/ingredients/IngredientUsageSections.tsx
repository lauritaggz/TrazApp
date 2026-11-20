import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import ProductDetailSection from "@/components/products/ProductDetailSection";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { listIngredientProducts, listIngredientSupplies } from "@/services/ingredientService";
import type { IngredienteInsumoAsociado, IngredienteUsoProducto } from "@/types/ingredient";

type Estado<T> = { fase: "cargando" } | { fase: "error" } | { fase: "ok"; datos: T[] };

/**
 * Loads one read-only list of the ingredient detail. Each section owns its own request, so both
 * run in parallel and a failure stays in its section (HT08). A late answer for a previous
 * ingredient is discarded.
 */
function useListaDelIngrediente<T>(
  ingredienteId: number,
  cargar: (id: number) => Promise<T[]>,
): { estado: Estado<T>; recargar: () => void } {
  const [intento, setIntento] = useState(0);
  // The answer remembers which request it belongs to; until the current one answers, it is loading.
  const [respuesta, setRespuesta] = useState<{ clave: string; estado: Estado<T> } | null>(null);
  const clave = `${ingredienteId}:${intento}`;

  useEffect(() => {
    let vigente = true;
    cargar(ingredienteId).then(
      (datos) => {
        if (vigente) setRespuesta({ clave, estado: { fase: "ok", datos: Array.isArray(datos) ? datos : [] } });
      },
      () => {
        if (vigente) setRespuesta({ clave, estado: { fase: "error" } });
      },
    );
    return () => {
      vigente = false;
    };
  }, [ingredienteId, cargar, clave]);

  const recargar = useCallback(() => setIntento((n) => n + 1), []);
  const estado: Estado<T> = respuesta?.clave === clave ? respuesta.estado : { fase: "cargando" };
  return { estado, recargar };
}

/** Rows shown before «Ver todos (n)». The server returns the whole list (no server pagination). */
export const FILAS_VISIBLES = 5;

const BOTON_VER =
  "inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-accent-strong underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent";

const FILA =
  "flex min-h-11 flex-col gap-0.5 px-4 py-3 hover:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent";

interface SeccionListaProps<T> {
  id: string;
  titulo: string;
  descripcion: string;
  estado: Estado<T>;
  recargar: () => void;
  textoCargando: string;
  textoError: string;
  textoVacio: string;
  etiquetaLista: string;
  fila: (item: T) => ReactNode;
  clave: (item: T) => number;
}

function SeccionLista<T>({
  id,
  titulo,
  descripcion,
  estado,
  recargar,
  textoCargando,
  textoError,
  textoVacio,
  etiquetaLista,
  fila,
  clave,
}: SeccionListaProps<T>) {
  const [expandida, setExpandida] = useState(false);
  const tituloConContador = estado.fase === "ok" ? `${titulo} (${estado.datos.length})` : titulo;
  const datos = estado.fase === "ok" ? estado.datos : [];
  const total = datos.length;
  const visibles = expandida ? datos : datos.slice(0, FILAS_VISIBLES);
  const idLista = `${id}-lista`;
  return (
    <ProductDetailSection id={id} title={tituloConContador} description={descripcion}>
      {estado.fase === "cargando" && (
        <p className="text-sm text-text-secondary" aria-live="polite">
          {textoCargando}
        </p>
      )}

      {estado.fase === "error" && (
        <Alert type="error">
          <p>{textoError}</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={recargar}>
            Reintentar
          </Button>
        </Alert>
      )}

      {estado.fase === "ok" && estado.datos.length === 0 && (
        <p className="text-sm text-text-secondary">{textoVacio}</p>
      )}

      {total > 0 && (
        <div className="space-y-2">
          <ul
            id={idLista}
            aria-label={etiquetaLista}
            className="divide-y divide-border overflow-hidden rounded-xl border border-border"
          >
            {visibles.map((item) => (
              <li key={clave(item)}>{fila(item)}</li>
            ))}
          </ul>
          {total > FILAS_VISIBLES && (
            // Expands in place: the focus stays on this button.
            <button
              type="button"
              className={BOTON_VER}
              aria-expanded={expandida}
              aria-controls={idLista}
              onClick={() => setExpandida((valor) => !valor)}
            >
              {expandida ? "Ver menos" : `Ver todos (${total})`}
            </button>
          )}
        </div>
      )}
    </ProductDetailSection>
  );
}

/** «Uso en formulaciones» (HT08, CA1, CA3, CA4): products whose current formulation has the ingredient. */
export function IngredientProductsSection({ ingredienteId }: { ingredienteId: number }) {
  const { estado, recargar } = useListaDelIngrediente(ingredienteId, listIngredientProducts);
  return (
    <SeccionLista<IngredienteUsoProducto>
      id="ingredient-detail-uso"
      titulo="Uso en formulaciones"
      descripcion="Productos cuya formulación vigente incluye este ingrediente."
      estado={estado}
      recargar={recargar}
      textoCargando="Cargando productos..."
      textoError="No pudimos cargar los productos."
      textoVacio="Este ingrediente no está en la formulación vigente de ningún producto."
      etiquetaLista="Productos que usan este ingrediente"
      clave={(producto) => producto.id}
      fila={(producto) => (
        <Link to={`/productos/${producto.id}`} className={FILA}>
          <span className="break-words text-sm font-medium text-text-primary">{producto.nombre}</span>
          <span className="text-xs text-text-secondary">Versión {producto.numero_version}</span>
        </Link>
      )}
    />
  );
}

/** «Insumos asociados» (HT08, CA2, CA3, CA4): active and inactive supplies of the ingredient. */
export function IngredientSuppliesSection({ ingredienteId }: { ingredienteId: number }) {
  const { estado, recargar } = useListaDelIngrediente(ingredienteId, listIngredientSupplies);
  return (
    <SeccionLista<IngredienteInsumoAsociado>
      id="ingredient-detail-insumos"
      titulo="Insumos asociados"
      descripcion="Insumos comerciales asociados a este ingrediente."
      estado={estado}
      recargar={recargar}
      textoCargando="Cargando insumos..."
      textoError="No pudimos cargar los insumos."
      textoVacio="Este ingrediente no tiene insumos asociados."
      etiquetaLista="Insumos de este ingrediente"
      clave={(insumo) => insumo.id}
      fila={(insumo) => (
        <Link to={`/insumos/${insumo.id}`} className={FILA}>
          <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <span
              className={`min-w-0 break-words text-sm font-medium ${
                insumo.activo ? "text-text-primary" : "text-text-secondary"
              }`}
            >
              {insumo.nombre}
            </span>
            <Badge variant={insumo.activo ? "success" : "neutral"}>
              {insumo.activo ? "Activo" : "Inactivo"}
            </Badge>
          </span>
          <span className="break-words text-xs text-text-secondary">{insumo.marca_origen}</span>
        </Link>
      )}
    />
  );
}
