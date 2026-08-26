import { useNavigate, useParams } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import { useAppShell } from "@/hooks/useAppShell";

/** Temporary route shell until T01-06 (create) and T01-07 (detail) are implemented. */
export function ProductNewPlaceholder() {
  const navigate = useNavigate();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  return (
    <AppShell
      activePage="productos"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <RouteShellContent
        title="Nuevo producto"
        description="El formulario de creación se implementará en T01-06."
        backLabel="Volver a productos"
        onBack={() => navigate("/productos")}
      />
    </AppShell>
  );
}

/** Temporary route shell until T01-07 implements the full product detail view. */
export function ProductDetailPlaceholder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();

  return (
    <AppShell
      activePage="productos"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      <RouteShellContent
        title="Detalle de producto"
        description={`La vista completa del producto #${id ?? ""} se implementará en T01-07.`}
        backLabel="Volver a productos"
        onBack={() => navigate("/productos")}
      />
    </AppShell>
  );
}

function RouteShellContent({
  title,
  description,
  backLabel,
  onBack,
}: {
  title: string;
  description: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-lg space-y-4">
      <div>
        <p className="text-sm text-brand-600 font-medium mb-1">Productos</p>
        <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
          {title}
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed">
          {description}
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={onBack}>
        {backLabel}
      </Button>
    </div>
  );
}
