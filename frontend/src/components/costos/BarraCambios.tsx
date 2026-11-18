import Button from "@/components/ui/Button";

interface BarraCambiosProps {
  guardando: boolean;
  onGuardar: () => void;
  onDescartar: () => void;
}

/** Se pega al borde inferior mientras hay cambios sin guardar. */
export default function BarraCambios({ guardando, onGuardar, onDescartar }: BarraCambiosProps) {
  return (
    <div
      role="region"
      aria-label="Cambios sin guardar"
      className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-card px-4 py-3 shadow-lg sm:mx-0 sm:rounded-xl sm:border"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-text-primary">Tienes cambios sin guardar</p>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" disabled={guardando} onClick={onDescartar}>
            Descartar
          </Button>
          <Button type="button" loading={guardando} onClick={onGuardar}>
            Guardar cambios
          </Button>
        </div>
      </div>
    </div>
  );
}
