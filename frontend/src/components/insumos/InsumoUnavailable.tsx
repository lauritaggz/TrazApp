import Button from "@/components/ui/Button";

export default function InsumoUnavailable({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg space-y-4 rounded-xl border border-border bg-card p-8 text-center">
      <h1 className="text-xl font-semibold text-text-primary">Insumo no disponible.</h1>
      <p className="text-sm leading-relaxed text-text-secondary">
        No pudimos encontrar este insumo dentro de tu cuenta.
      </p>
      <Button type="button" variant="secondary" onClick={onBack}>
        Volver a insumos
      </Button>
    </div>
  );
}
