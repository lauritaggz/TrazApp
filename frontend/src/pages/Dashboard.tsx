import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardGettingStarted from "@/components/dashboard/DashboardGettingStarted";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DashboardProductPreviewCard from "@/components/dashboard/DashboardProductPreviewCard";
import DashboardRecentIngredients from "@/components/dashboard/DashboardRecentIngredients";
import DashboardSection from "@/components/dashboard/DashboardSection";
import DashboardStatCard from "@/components/dashboard/DashboardStatCard";
import {
  BoxIcon,
  CheckCircleIcon,
  LeafIcon,
} from "@/components/dashboard/dashboardIcons";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import { useAppShell } from "@/hooks/useAppShell";
import { listIngredients } from "@/services/ingredientService";
import { listProducts } from "@/services/productService";
import type { Ingrediente } from "@/types/ingredient";
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingrediente[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingIngredients, setLoadingIngredients] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [ingredientsError, setIngredientsError] = useState("");

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

  useEffect(() => {
    void loadProducts();
    void loadIngredients();
  }, [loadProducts, loadIngredients]);

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

  const compoundCount = ingredients.filter((item) => item.tipo === "compuesto").length;
  const simpleCount = ingredients.filter((item) => item.tipo === "simple").length;

  const hasProducts = products.length > 0 && !productsError;
  const hasIngredients = ingredients.length > 0 && !ingredientsError;

  return (
    <AppShell
      activePage="inicio"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <div className="w-full space-y-7">
        <DashboardHeader firstName={firstName} businessName={businessName} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <DashboardStatCard
            label="Productos registrados"
            value={productsError ? "—" : products.length}
            icon={<BoxIcon />}
            accent="#2f6b57"
            loading={loadingProducts}
          />
          <DashboardStatCard
            label="Ingredientes"
            value={ingredientsError ? "—" : ingredients.length}
            icon={<LeafIcon />}
            accent="#2f6b57"
            loading={loadingIngredients}
          />
          <DashboardStatCard
            label="Ingredientes compuestos"
            value={ingredientsError ? "—" : compoundCount}
            icon={<CheckCircleIcon />}
            accent="#027a48"
            loading={loadingIngredients}
          />
          <DashboardStatCard
            label="Ingredientes simples"
            value={ingredientsError ? "—" : simpleCount}
            icon={<LeafIcon />}
            accent="#2f6b57"
            loading={loadingIngredients}
          />
        </div>

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
            <div className="space-y-3 rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-text-secondary">
                Aún no has registrado productos.
              </p>
              <Button type="button" onClick={() => navigate("/productos")}>
                Registrar primer producto
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recentProducts.map((product, index) => (
                <DashboardProductPreviewCard
                  key={product.id}
                  product={product}
                  index={index}
                  onClick={() => navigate(`/productos/${product.id}`)}
                />
              ))}
            </div>
          )}
        </DashboardSection>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardRecentIngredients
            ingredients={sortedIngredients}
            loading={loadingIngredients}
            error={ingredientsError}
            onRetry={() => void loadIngredients()}
            onViewAll={() => navigate("/ingredientes")}
          />
          <DashboardGettingStarted
            hasProducts={hasProducts}
            hasIngredients={hasIngredients}
          />
        </div>
      </div>
    </AppShell>
  );
}
