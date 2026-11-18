import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import BarraCambios from "@/components/costos/BarraCambios";
import { CheckIcon, InfoIcon, ProductoIcon } from "@/components/costos/iconosCostos";
import LineaCostoFila, { COLUMNAS_LINEA } from "@/components/costos/LineaCostoFila";
import OtrosCostosEditor from "@/components/costos/OtrosCostosEditor";
import ResumenCostos from "@/components/costos/ResumenCostos";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import Select from "@/components/ui/Select";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useAppShell } from "@/hooks/useAppShell";
import { useCalculadoraCostos } from "@/hooks/useCalculadoraCostos";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { ingredientCountLabel } from "@/lib/formulationUtils";
import { listProducts } from "@/services/productService";
import type { Product } from "@/types/product";

/** `?producto=<id>`: un entero positivo, o nada. */
function productoDeLaUrl(valor: string | null): number | null {
  return valor !== null && /^\d{1,9}$/.test(valor) && Number(valor) > 0 ? Number(valor) : null;
}

const BOTON_ENLACE =
  "inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700";

/** Calculadora de costos (HU14): cuánto cuesta una tanda de un producto y cada unidad. */
export default function CostCalculator() {
  const { handleLogout, producerName, businessName } = useAppShell();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const productoId = productoDeLaUrl(params.get("producto"));

  const [productos, setProductos] = useState<Product[]>([]);
  const [cargandoProductos, setCargandoProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState(false);
  const [productoPendiente, setProductoPendiente] = useState<number | null | undefined>(undefined);

  const calc = useCalculadoraCostos(productoId);
  const { pendingHref, clearPending } = useUnsavedChangesGuard(calc.sucio && !calc.guardando);

  const cargarProductos = useCallback(async () => {
    setCargandoProductos(true);
    setErrorProductos(false);
    try {
      setProductos(await listProducts());
    } catch {
      setErrorProductos(true);
    } finally {
      setCargandoProductos(false);
    }
  }, []);

  useEffect(() => {
    void cargarProductos();
  }, [cargarProductos]);

  function irAlProducto(id: number | null) {
    setParams(id === null ? {} : { producto: String(id) });
  }

  function pedirProducto(valor: string) {
    const id = valor === "" ? null : Number(valor);
    if (calc.sucio) setProductoPendiente(id);
    else irAlProducto(id);
  }

  const { datos, borrador } = calc;
  const hayProductos = !cargandoProductos && !errorProductos && productos.length > 0;
  const mostrandoCalculo = productoId !== null && calc.estado === "listo" && datos && borrador && datos.tiene_formulacion;

  return (
    <AppShell
      activePage="calculadora"
      pageTitle="Calculadora de costos"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className={`max-w-6xl ${calc.sucio || calc.guardando ? "pb-28" : ""}`}>
        {/* 1. Encabezado: título a la izquierda, selector de producto a la derecha (debajo en celular). */}
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold tracking-wide text-accent">Herramientas</p>
            <h1 className="text-2xl font-semibold text-text-primary">Calculadora de costos</h1>
            <p className="mt-1 text-sm text-text-secondary">Estima el costo de producir una tanda y cada unidad.</p>
          </div>
          {hayProductos && (
            <div className="w-full lg:w-80">
              <Select
                label="Producto"
                value={productoId === null ? "" : String(productoId)}
                onChange={(e) => pedirProducto(e.target.value)}
              >
                <option value="">Elige un producto…</option>
                {productoId !== null && !productos.some((p) => p.id === productoId) && (
                  <option value={productoId}>Producto {productoId}</option>
                )}
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* 2. Aviso de estimación. */}
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card text-accent">
            <InfoIcon />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">Esta es una estimación con precios vigentes</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              No modifica elaboraciones ni versiones. Cambiar un insumo aquí solo afecta este cálculo; las cantidades
              se guardan en el producto. El precio de Jumbo puede ser una oferta; si no es el que pagas, corrígelo en
              el insumo.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          {cargandoProductos && <ListSkeleton rows={2} label="Cargando tus productos..." />}

          {errorProductos && !cargandoProductos && (
            <Alert type="error">
              <p>No pudimos cargar tus productos. Revisa tu conexión e inténtalo de nuevo.</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={() => void cargarProductos()}>
                Reintentar
              </Button>
            </Alert>
          )}

          {!cargandoProductos && !errorProductos && productos.length === 0 && (
            <EmptyStateCard
              title="Aún no tienes productos"
              description="Registra un producto y define su formulación para calcular cuánto cuesta prepararlo."
              action={
                <Link to="/productos/nuevo" className={BOTON_ENLACE}>
                  Nuevo producto
                </Link>
              }
            />
          )}

          {hayProductos && productoId === null && (
            <p className="text-sm text-text-secondary">Elige un producto para calcular su costo.</p>
          )}

          {productoId !== null && calc.estado === "cargando" && (
            <ListSkeleton rows={3} label="Calculando los costos..." />
          )}

          {productoId !== null && calc.estado === "error" && (
            <Alert type="error">
              <p>No pudimos calcular los costos. Revisa tu conexión e inténtalo de nuevo.</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={calc.reintentarCarga}>
                Reintentar
              </Button>
            </Alert>
          )}

          {productoId !== null && calc.estado === "no-encontrado" && (
            <EmptyStateCard
              title="Producto no encontrado"
              description="Este producto no existe o ya no está disponible. Elige otro para calcular su costo."
              action={
                <Link to="/calculadora" className={BOTON_ENLACE}>
                  Elegir otro producto
                </Link>
              }
            />
          )}

          {productoId !== null && calc.estado === "listo" && datos && !datos.tiene_formulacion && (
            <EmptyStateCard
              title="Este producto aún no tiene formulación"
              description={`Define los ingredientes de ${datos.producto_nombre} para poder calcular su costo.`}
              action={
                <Link to={`/productos/${datos.producto_id}#product-detail-formulation`} className={BOTON_ENLACE}>
                  Definir la formulación
                </Link>
              }
            />
          )}

          {mostrandoCalculo && (
            <>
              {calc.errorGeneral && (
                <Alert type="error">
                  <p>{calc.errorGeneral}</p>
                  <Button type="button" variant="secondary" className="mt-3" onClick={() => void calc.guardar()}>
                    Reintentar
                  </Button>
                </Alert>
              )}
              {calc.errorRecalculo && (
                <Alert type="error">
                  <p>No pudimos recalcular los costos. {calc.errorRecalculo}</p>
                  <p className="mt-1 font-normal">Se muestra el último cálculo.</p>
                  <Button type="button" variant="secondary" className="mt-3" onClick={calc.reintentarRecalculo}>
                    Reintentar
                  </Button>
                </Alert>
              )}

              {/* 3. Dos columnas desde xl: principal + lateral de 300 px (pegada al desplazar). */}
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-5">
                  {/* 4. Ingredientes de la formulación vigente. */}
                  <section
                    aria-labelledby="costos-lineas"
                    className="overflow-hidden rounded-xl border border-border bg-card shadow-soft"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-accent">
                          <ProductoIcon />
                        </span>
                        <div className="min-w-0">
                          <h2 id="costos-lineas" className="text-sm font-semibold text-text-primary">
                            Ingredientes de la formulación vigente
                          </h2>
                          <p className="mt-0.5 text-xs text-text-secondary">{ingredientCountLabel(datos.lineas.length)}</p>
                        </div>
                      </div>
                      <p
                        role="status"
                        className={`inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                          calc.sucio ? "text-warning" : "text-success"
                        }`}
                      >
                        {calc.sucio ? (
                          "Cambios sin guardar"
                        ) : (
                          <>
                            <CheckIcon size={12} />
                            Guardado
                          </>
                        )}
                      </p>
                    </div>

                    <div
                      aria-hidden="true"
                      className={`hidden gap-4 border-b border-border bg-surface px-5 py-2.5 text-xs font-semibold tracking-wide text-text-muted lg:grid ${COLUMNAS_LINEA}`}
                    >
                      <span>Ingrediente</span>
                      <span>Insumo seleccionado</span>
                      <span>Cantidad por tanda</span>
                      <span className="text-right">Costo</span>
                    </div>

                    <ul className="divide-y divide-border" aria-busy={calc.recalculando}>
                      {datos.lineas.map((linea) => (
                        <LineaCostoFila
                          key={linea.ingrediente_id}
                          linea={linea}
                          productoId={datos.producto_id}
                          borrador={borrador.lineas[linea.ingrediente_id] ?? { cantidad: "", unidad: "" }}
                          errores={calc.errores.lineas[linea.ingrediente_id]}
                          errorServidor={
                            calc.errorDeLinea?.ingredienteId === linea.ingrediente_id
                              ? calc.errorDeLinea.mensaje
                              : undefined
                          }
                          recalculando={calc.recalculando}
                          onCambiar={(cambios) => calc.cambiarLinea(linea.ingrediente_id, cambios)}
                          onElegirInsumo={(insumoId) => calc.elegirInsumo(linea.ingrediente_id, insumoId)}
                          onPrecioActualizado={calc.recalcular}
                        />
                      ))}
                    </ul>
                  </section>

                  {/* 5. Otros costos por tanda. */}
                  <OtrosCostosEditor
                    otros={borrador.otros}
                    errores={calc.errores}
                    onAgregar={calc.agregarOtroCosto}
                    onCambiar={calc.cambiarOtroCosto}
                    onQuitar={calc.quitarOtroCosto}
                  />
                </div>

                {/* 6. Columna lateral: resumen del cálculo. */}
                <ResumenCostos
                  datos={datos}
                  sucio={calc.sucio}
                  rendimiento={borrador.rendimiento}
                  errorRendimiento={calc.errores.rendimiento}
                  onRendimiento={calc.cambiarRendimiento}
                />
              </div>

              {/* 7. Barra inferior de cambios sin guardar. */}
              {(calc.sucio || calc.guardando) && (
                <BarraCambios
                  guardando={calc.guardando}
                  onGuardar={() => void calc.guardar()}
                  onDescartar={calc.descartar}
                />
              )}
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingHref !== null || productoPendiente !== undefined}
        title="Salir sin guardar"
        description="Tienes cambios sin guardar. Si sigues, se pierden."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          const href = pendingHref;
          const producto = productoPendiente;
          clearPending();
          setProductoPendiente(undefined);
          if (href) navigate(href);
          else if (producto !== undefined) irAlProducto(producto);
        }}
        onCancel={() => {
          clearPending();
          setProductoPendiente(undefined);
        }}
      />
    </AppShell>
  );
}
