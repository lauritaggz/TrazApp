import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface ConfirmarReemplazoDatosProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A product was found but the form already has the productor's own data (HU13). */
export default function ConfirmarReemplazoDatos({
  open,
  onConfirm,
  onCancel,
}: ConfirmarReemplazoDatosProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Reemplazar los datos del formulario"
      description="Ya escribiste datos en el formulario. Si continúas, se reemplazan por los del producto encontrado. El ingrediente que elegiste se conserva."
      confirmLabel="Reemplazar datos"
      cancelLabel="Conservar lo escrito"
      destructive
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
