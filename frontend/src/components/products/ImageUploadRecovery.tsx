import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";

interface ImageUploadRecoveryProps {
  message: string;
  retrying?: boolean;
  onRetry: () => void;
  onContinue: () => void;
  continueLabel?: string;
}

export default function ImageUploadRecovery({
  message,
  retrying = false,
  onRetry,
  onContinue,
  continueLabel = "Continuar al producto",
}: ImageUploadRecoveryProps) {
  return (
    <Alert type="error">
      <div className="space-y-3">
        <p>{message}</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            className="w-full sm:w-auto"
            loading={retrying}
            disabled={retrying}
            onClick={onRetry}
          >
            Reintentar subida
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={retrying}
            onClick={onContinue}
          >
            {continueLabel}
          </Button>
        </div>
      </div>
    </Alert>
  );
}
