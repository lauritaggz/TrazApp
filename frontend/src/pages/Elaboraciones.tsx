import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import HistorialCifras from "@/components/elaboraciones/historial/HistorialCifras";
import HistorialFila from "@/components/elaboraciones/historial/HistorialFila";
import ElaboracionesPestanas from "@/components/elaboraciones/relacionadas/ElaboracionesPestanas";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import { Input } from "@/components/ui/Input";
import ListToolbar, { type FilterChip } from "@/components/ui/ListToolbar";
import PageHeader from "@/components/ui/PageHeader";
import Pagination from "@/components/ui/Pagination";
import Select from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppShell } from "@/hooks/useAppShell";
import { useHistorialElaboraciones } from "@/hooks/useHistorialElaboraciones";
import { formatFecha } from "@/lib/elaboracionUtils";
import { hayFiltros, rangoDePagina, ultimaPagina } from "@/lib/historialElaboraciones";
import { listProducts } from "@/services/productService";
import type { EstadoElaboracion } from "@/types/elaboracion";

/**
 * The history of the productor's elaboraciones (HU06): filters, search by code and pages. The filters
 * are in the URL; the three totals on top are the whole picture and do not follow them.
 */
export default function Elaboraciones() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } = useAppShell();
  const historial = useHistorialElaboraciones();
  const { filtros, items, total, loading, error, fechasInvalidas } = historial;
  const [productos, setProductos] = useState<{ id: number; nombre: string }[]>([]);
  const inicioLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vigente = true;
    listProducts().then(
      (lista) => {
        if (vigente) setProductos(lista.map((p) => ({ id: p.id, nombre: p.nombre })));
      },
      () => {
        // Without the list the product filter has no options; the rest of the page still works.
      },
    );
    return () => {
      vigente = false;
    };
  }, []);

  const conFiltros = hayFiltros(filtros);
  const totalPaginas = ultimaPagina(total);

  function irAPagina(pagina: number) {
    historial.irAPagina(pagina);
    inicioLista.current?.scrollIntoView({ block: "start" });
  }

  const chips: FilterChip[] = [];
  if (filtros.codigo) {
    chips.push({
      key: "search",
      label: `Código: «${filtros.codigo}»`,
      onRemove: () => {
        historial.setCodigoTexto("");
        historial.cambiarFiltros({ codigo: "" });
      },
    });
  }
  if (filtros.producto !== null) {
    const nombre = productos.find((p) => p.id === filtros.producto)?.nombre ?? `Producto ${filtros.producto}`;
    chips.push({ key: "producto", label: `Producto: ${nombre}`, onRemove: () => historial.cambiarFiltros({ producto: null }) });
  }
  if (filtros.estado) {
    chips.push({
      key: "estado",
      label: `Estado: ${filtros.estado === "borrador" ? "Borrador" : "Finalizada"}`,
      onRemove: () => historial.cambiarFiltros({ estado: null }),
    });
  }
  if (filtros.desde) {
    chips.push({ key: "desde", label: `Desde: ${formatFecha(filtros.desde)}`, onRemove: () => historial.cambiarFiltros({ desde: null }) });
  }
  if (filtros.hasta) {
    chips.push({ key: "hasta", label: `Hasta: ${formatFecha(filtros.hasta)}`, onRemove: () => historial.cambiarFiltros({ hasta: null }) });
  }

  const encontradas =
    loading || error || fechasInvalidas
      ? undefined
      : `${total} ${total === 1 ? "elaboración encontrada" : "elaboraciones encontradas"}`;

  return (
    <AppShell
      activePage="elaboraciones"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-5xl space-y-6">
        <PageHeader
          title="Elaboraciones"
          description="Consulta qué insumos, marcas y lotes se usaron en cada elaboración."
        />

        <ElaboracionesPestanas activa="historial" />

        <HistorialCifras />

        <div ref={inicioLista} className="scroll-mt-4 space-y-4">
          <ListToolbar
            search={historial.codigoTexto}
            onSearchChange={historial.setCodigoTexto}
            onSearchEnter={historial.buscarCodigoYa}
            layout="fila"
            searchLabel="Buscar elaboración por código"
            searchPlaceholder="Buscar por código"
            chips={chips}
            onClearAll={historial.limpiar}
            status={encontradas}
            controls={
              <>
                {/* From lg all of this shares one row with the search: the labels of the product and the state
                    are for screen readers only; «Desde» and «Hasta» stay visible beside their field. */}
                <div className="lg:w-36 lg:shrink-0">
                  <Select
                    label="Producto"
                    labelClassName="lg:sr-only"
                    value={filtros.producto === null ? "" : String(filtros.producto)}
                    onChange={(e) => historial.cambiarFiltros({ producto: e.target.value ? Number(e.target.value) : null })}
                  >
                    <option value="">Todos</option>
                    {productos.map((producto) => (
                      <option key={producto.id} value={producto.id}>
                        {producto.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="lg:w-28 lg:shrink-0">
                  <Select
                    label="Estado"
                    labelClassName="lg:sr-only"
                    value={filtros.estado ?? ""}
                    onChange={(e) => historial.cambiarFiltros({ estado: (e.target.value || null) as EstadoElaboracion | null })}
                  >
                    <option value="">Todos</option>
                    <option value="borrador">Borrador</option>
                    <option value="finalizada">Finalizada</option>
                  </Select>
                </div>
                <div className="lg:w-[12.5rem] lg:shrink-0">
                  <Input
                    label="Desde"
                    labelBesideFromLg
                    type="date"
                    value={filtros.desde ?? ""}
                    onChange={(e) => historial.cambiarFiltros({ desde: e.target.value || null })}
                  />
                </div>
                <div className="lg:w-[12.5rem] lg:shrink-0">
                  <Input
                    label="Hasta"
                    labelBesideFromLg
                    type="date"
                    value={filtros.hasta ?? ""}
                    onChange={(e) => historial.cambiarFiltros({ hasta: e.target.value || null })}
                  />
                </div>
              </>
            }
          />

          {fechasInvalidas && (
            <p role="alert" className="rounded-lg border border-error-border bg-error-bg px-3.5 py-3 text-sm font-medium text-error">
              La fecha desde no puede ser posterior a la fecha hasta.
            </p>
          )}

          {loading && !fechasInvalidas && (
            <div className="space-y-3" aria-busy="true">
              <p className="text-sm text-text-secondary" aria-live="polite">
                Cargando elaboraciones...
              </p>
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-1/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3.5 w-20" />
                </div>
              ))}
            </div>
          )}

          {error && !loading && (
            <Alert type="error">
              <p>No pudimos cargar las elaboraciones. Revisa tu conexión e inténtalo de nuevo.</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={historial.recargar}>
                Reintentar
              </Button>
            </Alert>
          )}

          {!loading && !error && !fechasInvalidas && items.length === 0 && !conFiltros && (
            <EmptyStateCard
              title="Aún no tienes elaboraciones"
              description="Las elaboraciones se crean desde un producto con formulación. Aquí vas a poder consultar todas, con sus insumos, marcas y lotes."
              action={
                <Button type="button" onClick={() => navigate("/productos")}>
                  Ir a Productos
                </Button>
              }
            />
          )}

          {!loading && !error && !fechasInvalidas && items.length === 0 && conFiltros && (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <h2 className="mb-2 text-lg font-semibold text-text-primary">Ninguna elaboración coincide</h2>
              <p className="mb-6 text-sm text-text-secondary">
                No hay elaboraciones que coincidan con la búsqueda o los filtros seleccionados.
              </p>
              <Button type="button" variant="secondary" onClick={historial.limpiar}>
                Limpiar filtros
              </Button>
            </div>
          )}

          {!loading && !error && !fechasInvalidas && items.length > 0 && (
            <>
              <ul aria-label="Elaboraciones" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {items.map((elaboracion) => (
                  <HistorialFila key={elaboracion.id} elaboracion={elaboracion} />
                ))}
              </ul>
              <Pagination
                pagina={filtros.pagina}
                totalPaginas={totalPaginas}
                rango={rangoDePagina(filtros.pagina, items.length, total)}
                onChange={irAPagina}
                etiqueta="elaboraciones"
              />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
