import Button from "@/components/ui/Button";

export default function ProductUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4 max-w-lg">
      <h1 className="text-xl font-semibold text-text-primary">
        Producto no disponible.
      </h1>
      <p className="text-sm text-text-secondary leading-relaxed">
        No pudimos encontrar este producto dentro de tu cuenta.
      </p>
      <Button type="button" variant="secondary" onClick={onBack}>
        Volver a productos
      </Button>
    </div>
  );
}
