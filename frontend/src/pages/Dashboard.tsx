import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import DashboardAttention from "@/components/dashboard/DashboardAttention";
import DashboardElaboracionesEnCurso, {
  MAX_ELABORACIONES_EN_CURSO,
} from "@/components/dashboard/DashboardElaboracionesEnCurso";
import DashboardGettingStarted from "@/components/dashboard/DashboardGettingStarted";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardProductPreviewCard from "@/components/dashboard/DashboardProductPreviewCard";
import DashboardRecentIngredients from "@/components/dashboard/DashboardRecentIngredients";
import DashboardSection from "@/components/dashboard/DashboardSection";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import { AlertIcon, BoxIcon, FlagIcon } from "@/components/dashboard/dashboardIcons";
import ElaboracionCreateDialog from "@/components/elaboraciones/ElaboracionCreateDialog";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import { useAppShell } from "@/hooks/useAppShell";
import { productsWithGaps } from "@/lib/productCompleteness";
import { listElaboraciones } from "@/services/elaboracionService";
import { listIngredients } from "@/services/ingredientService";
import { listInsumos } from "@/services/insumoService";
import { listProducts } from "@/services/productService";
import type { ElaboracionResumen } from "@/types/elaboracion";
import type { Ingrediente } from "@/types/ingredient";
import type { Insumo } from "@/types/insumo";
import type { Product } from "@/types/product";

function sortRecentProducts(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const aKey = a.created_at ? new Date(a.created_at).getTime() : a.id;
    const bKey = b.created_at ? new Date(b.created_at).getTime() : b.id;
    return bKey - aKey;
  });
}

function sortRecentIngredients(ingredientes: Ingrediente[]): Ingrediente[] {
  return [...ingredientes].sort((a, b) => {
    const aKey = a.created_at ? new Date(a.created_at).getTime() : a.id;
    const bKey = b.created_at ? new Date(b.created_at).getTime() : b.id;
    return bKey - aKey;
  });
}

/**
 * Where «Ver todas» of «Elaboraciones en curso» goes: the historial filtered by drafts (HU06).
 */
const RUTA_BORRADORES: string | undefined = "/elaboraciones?estado=borrador";

export default function Dashboard() {
  const navigate = useNavigate();
  const { handleLogout, producerName, businessName } =
    useAppShell();

  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [ingredientsError, setIngredientsError] = useState("");
  // Elaboraciones (HT06-07): the drafts feed «Elaboraciones en curso» and any of them marks the third step done.
  // A secondary block: if it fails to load it is simply not shown.
  const [borradores, setBorradores] = useState<ElaboracionResumen[]>([]);
  const [totalBorradores, setTotalBorradores] = useState(0);
  const [totalElaboraciones, setTotalElaboraciones] = useState(0);
  // Active supplies, to count the ones with allergens still to review (HT07).
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loadingInsumos, setLoadingInsumos] = useState(true);
  const [insumosError, setInsumosError] = useState(false);
  const [elaboracionDialogOpen, setElaboracionDialogOpen] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductsError("");
    try {
      const data = await listProducts();
      setProducts(data);
    } catch {
      setProductsError("No pudimos cargar tus productos.");
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadIngredients = useCallback(async () => {
    setLoadingIngredients(true);
    setIngredientsError("");
    try {
      const data = await listIngredients();
      setIngredients(data);
    } catch {
      setIngredientsError("No pudimos cargar tus ingredientes.");
    } finally {
      setLoadingIngredients(false);
    }
  }, []);

  // «Elaboraciones en curso»: the latest drafts, and how many there are in all. «Primeros pasos»: whether there is
  // any elaboración at all (a page of one and its `total`). Each one fails on its own without touching the rest.
  const loadElaboraciones = useCallback(async () => {
    try {
      const pagina = await listElaboraciones({ estado: "borrador", limit: MAX_ELABORACIONES_EN_CURSO });
      setBorradores(pagina.items);
      setTotalBorradores(pagina.total);
    } catch {
      setBorradores([]);
      setTotalBorradores(0);
    }
    try {
      setTotalElaboraciones((await listElaboraciones({ limit: 1 })).total);
    } catch {
      setTotalElaboraciones(0);
    }
  }, []);

  const loadInsumos = useCallback(async () => {
    setLoadingInsumos(true);
    setInsumosError(false);
    try {
      setInsumos(await listInsumos({ activo: true }));
    } catch {
      setInsumosError(true);
    } finally {
      setLoadingInsumos(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
    void loadIngredients();
    void loadElaboraciones();
    void loadInsumos();
  }, [loadProducts, loadIngredients, loadElaboraciones, loadInsumos]);

  const insumosSinRevisar = useMemo(
    () => insumos.filter((insumo) => !insumo.alergenos_revisados).length,
    [insumos],
  );

  const firstName = useMemo(() => {
    const trimmed = producerName?.trim();
    if (!trimmed) return "Productor";
    return trimmed.split(/\s+/)[0] ?? trimmed;
  }, [producerName]);

  const recentProducts = useMemo(
    () => sortRecentProducts(products).slice(0, 4),
    [products],
  );

  const sortedIngredients = useMemo(
    () => sortRecentIngredients(ingredients),
    [ingredients],
  );

  // Only the products with a formulation can have an elaboración (the list says so: tiene_formulacion).
  const productosConFormulacion = useMemo(
    () =>
      products
        .filter((product) => product.tiene_formulacion)
        .map((product) => ({ id: product.id, nombre: product.nombre })),
    [products],
  );
  const puedeRegistrarElaboracion =
    loadingProducts || productsError ? null : productosConFormulacion.length > 0;

  const incompleteProducts = useMemo(() => productsWithGaps(products), [products]);
  const hasProducts = products.length > 0 && !productsError;
  const hasIngredients = ingredients.length > 0 && !ingredientsError;

  return (
    <AppShell
      activePage="inicio"
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="w-full space-y-8">
        <DashboardHeader
          firstName={firstName}
          businessName={businessName}
          puedeRegistrarElaboracion={puedeRegistrarElaboracion}
          onNuevaElaboracion={() => setElaboracionDialogOpen(true)}
        />

        {/* Las cifras de la semana: cada tarjeta lleva a lo que cuenta. */}
        <div className="reveal grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4" style={{ "--i": 4 } as CSSProperties}>
          <DashboardStatCard
            label="Productos registrados"
            value={productsError ? "—" : products.length}
            icon={<BoxIcon />}
            loading={loadingProducts}
            to="/productos"
          />
          {/* The number of the week: supplies whose allergens nobody reviewed. At 0 it says so, in a positive tone. */}
          {!loadingInsumos && !insumosError && insumos.length === 0 ? (
            <DashboardStatCard
              label="Insumos registrados"
              value={0}
              icon={<AlertIcon />}
              to="/insumos"
            />
          ) : !loadingInsumos && !insumosError && insumosSinRevisar === 0 ? (
            <DashboardStatCard
              label="Todos tus insumos tienen los alérgenos revisados"
              value="Al día"
              icon={<AlertIcon />}
              tono="positivo"
              to="/insumos"
            />
          ) : (
            <DashboardStatCard
              label="Insumos con alérgenos sin revisar"
              value={insumosError ? "—" : insumosSinRevisar}
              icon={<AlertIcon />}
              loading={loadingInsumos}
              tono={!insumosError && insumosSinRevisar > 0 ? "alerta" : "normal"}
              to="/insumos?alergenos=sin-revisar"
            />
          )}
          <DashboardStatCard
            label="Productos por completar"
            value={productsError ? "—" : incompleteProducts.length}
            icon={<FlagIcon />}
            loading={loadingProducts}
            to="/productos"
          />
        </div>

        <div
          className="reveal grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:gap-6"
          style={{ "--i": 5 } as CSSProperties}
        >
          {/* Lo que pide acción va primero; lo reciente después. */}
          <div className="min-w-0 space-y-6">
            <DashboardElaboracionesEnCurso
              borradores={borradores}
              total={totalBorradores}
              verTodasTo={RUTA_BORRADORES}
            />

            {!loadingProducts && !productsError && incompleteProducts.length > 0 && (
              <DashboardAttention items={incompleteProducts} />
            )}

            <DashboardSection
              title="Tus productos"
              description="Últimos productos registrados"
              actionLabel="Ver todos los productos"
              onAction={() => navigate("/productos")}
            >
              {loadingProducts ? (
                <p className="text-sm text-text-secondary" aria-live="polite">
                  Cargando productos...
                </p>
              ) : productsError ? (
                <div className="space-y-3" role="alert">
                  <p className="text-sm text-error">{productsError}</p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => void loadProducts()}
                  >
                    Reintentar
                  </Button>
                </div>
              ) : recentProducts.length === 0 ? (
                <div className="space-y-3 rounded-2xl border border-dashed border-wheat-deep bg-panel p-5">
                  <p className="text-sm text-text-secondary">
                    Aún no tienes productos.
                  </p>
                  <Button type="button" onClick={() => navigate("/productos")}>
                    Crear tu primer producto
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {recentProducts.map((product) => (
                    <DashboardProductPreviewCard
                      key={product.id}
                      product={product}
                      onClick={() => navigate(`/productos/${product.id}`)}
                    />
                  ))}
                </div>
              )}
            </DashboardSection>
          </div>

          <aside aria-label="Tu avance" className="space-y-6">
            <DashboardGettingStarted
              hasProducts={hasProducts}
              hasIngredients={hasIngredients}
              hasElaboraciones={totalElaboraciones > 0}
            />
            <DashboardRecentIngredients
              ingredients={sortedIngredients}
              loading={loadingIngredients}
              error={ingredientsError}
              onRetry={() => void loadIngredients()}
              onViewAll={() => navigate("/ingredientes")}
            />
          </aside>
        </div>
      </div>

      {elaboracionDialogOpen && (
        <ElaboracionCreateDialog
          productos={productosConFormulacion}
          onCreated={(creada) => navigate(`/elaboraciones/${creada.id}/registro`)}
          onCancel={() => setElaboracionDialogOpen(false)}
        />
      )}
    </AppShell>
  );
}
