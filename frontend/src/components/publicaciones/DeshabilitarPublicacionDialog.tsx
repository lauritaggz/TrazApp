import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface DeshabilitarPublicacionDialogProps {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The confirmation before disabling a publication: the printed QR keeps working. */
export default function DeshabilitarPublicacionDialog({
  open,
  loading,
  onConfirm,
  onCancel,
}: DeshabilitarPublicacionDialogProps) {
  return (
    <ConfirmDialog
      open={open}
      title="Deshabilitar publicación"
      description={
        "El código QR que ya imprimiste seguirá funcionando, pero mostrará «información no disponible» mientras la publicación esté deshabilitada.\n\nPodrás volver a habilitarla cuando quieras: el QR y su enlace serán los mismos."
      }
      confirmLabel="Deshabilitar publicación"
      cancelLabel="Cancelar"
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
