import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import { CheckIcon, EyeIcon, GlobeIcon, ShieldIcon } from "@/components/publicaciones/iconos";
import PublicacionFila, { estaListo } from "@/components/publicaciones/PublicacionFila";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import EmptyStateCard from "@/components/ui/EmptyStateCard";
import PageHeader from "@/components/ui/PageHeader";
import { useAppShell } from "@/hooks/useAppShell";
import { listProducts } from "@/services/productService";
import type { Product } from "@/types/product";

/** Publicaciones (HU09): which products and elaboraciones the consumers can see. */
export default function Publicaciones() {
  const { handleLogout, producerName, businessName } = useAppShell();
  const [productos, setProductos] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setProductos(await listProducts());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const publicados = productos.filter((p) => p.publicado === true).length;
  const listos = productos.filter(estaListo).length;
  const visibles = productos.reduce((suma, p) => suma + (p.elaboraciones_visibles ?? 0), 0);

  return (
    <AppShell
      activePage="publicaciones"
      pageTitle="Publicaciones"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="max-w-6xl space-y-6">
        <PageHeader
          title="Publicaciones"
          description="Administra qué productos y elaboraciones pueden consultar tus consumidores."
          actions={
            <p className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-text-secondary">
              <ShieldIcon />
              La estructura pública está protegida por TrazApp
            </p>
          }
        />

        {loading && <p className="text-sm text-text-secondary" aria-live="polite">Cargando publicaciones...</p>}

        {error && !loading && (
          <Alert type="error">
            <p>No pudimos cargar tus productos. Revisa tu conexión e inténtalo de nuevo.</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void cargar()}>
              Reintentar
            </Button>
          </Alert>
        )}

        {!loading && !error && productos.length === 0 && (
          <EmptyStateCard
            title="Aún no tienes productos"
            description="Registra un producto, define su formulación y finaliza una elaboración para poder publicarlo."
            action={
              <Link
                to="/productos/nuevo"
                className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
              >
                Nuevo producto
              </Link>
            }
          />
        )}

        {!loading && !error && productos.length > 0 && (
          <>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metrica etiqueta="Productos publicados" valor={`${publicados} de ${productos.length}`} icono={<GlobeIcon />} />
              <Metrica etiqueta="Listos para publicar" valor={String(listos)} icono={<CheckIcon size={17} />} />
              <Metrica etiqueta="Elaboraciones visibles" valor={String(visibles)} icono={<EyeIcon />} />
            </dl>

            <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
              <p className="text-sm font-semibold text-text-primary">Un QR único para toda la vida del producto</p>
              <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
                Puedes imprimirlo una sola vez. Aunque deshabilites una publicación, el código no cambia y mostrará un
                mensaje seguro sin revelar información.
              </p>
            </div>

            <section aria-labelledby="publicaciones-lista" className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
                <div>
                  <h2 id="publicaciones-lista" className="text-sm font-semibold text-text-primary">
                    Tus productos
                  </h2>
                  <p className="mt-0.5 text-[13px] text-text-secondary">Revisa el estado y configura la información pública.</p>
                </div>
                <span className="text-[13px] text-text-secondary">
                  {productos.length} {productos.length === 1 ? "producto" : "productos"}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {productos.map((producto) => (
                  <PublicacionFila
                    key={producto.id}
                    product={producto}
                    onChange={(cambios) =>
                      setProductos((actual) => actual.map((p) => (p.id === producto.id ? { ...p, ...cambios } : p)))
                    }
                    onNotFound={() => setProductos((actual) => actual.filter((p) => p.id !== producto.id))}
                  />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metrica({ etiqueta, valor, icono }: { etiqueta: string; valor: string; icono: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-accent">
        {icono}
      </span>
      <div>
        <dd className="text-xl font-semibold tabular-nums text-text-primary">{valor}</dd>
        <dt className="mt-0.5 text-[13px] text-text-secondary">{etiqueta}</dt>
      </div>
    </div>
  );
}
