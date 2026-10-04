import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { fieldClassName } from "@/components/ui/fieldStyles";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className = "", ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = error ? `${textareaId}-error` : undefined;
  const hintId = hint && !error ? `${textareaId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-text-primary">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        className={fieldClassName(Boolean(error), `resize-y min-h-[6rem] ${className}`)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-[13px] text-error">
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-[13px] text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Textarea;
