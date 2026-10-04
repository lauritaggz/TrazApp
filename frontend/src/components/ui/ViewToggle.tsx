export interface ViewOption<T extends string> {
  value: T;
  label: string;
}

interface ViewToggleProps<T extends string> {
  label: string;
  value: T;
  options: ViewOption<T>[];
  onChange: (value: T) => void;
}

export default function ViewToggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: ViewToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-lg border border-border-strong bg-card p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`min-h-9 rounded-md px-3 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-50 text-accent-strong"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
