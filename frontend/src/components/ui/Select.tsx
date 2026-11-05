import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { fieldClassName } from "@/components/ui/fieldStyles";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  /** Extra classes of the label, for example `lg:sr-only` to hide it visually from `lg` (it stays the accessible name). */
  labelClassName?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = "", labelClassName = "", children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint && !error ? `${selectId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className={`text-sm font-medium text-text-primary ${labelClassName}`}>
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={fieldClassName(Boolean(error), className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId ?? hintId}
        {...props}
      >
        {children}
      </select>
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

export default Select;
