import { FlagIcon } from "@/components/dashboard/dashboardIcons";

interface DashboardGettingStartedProps {
  hasProducts: boolean;
  hasIngredients: boolean;
}

export default function DashboardGettingStarted({
  hasProducts,
  hasIngredients,
}: DashboardGettingStartedProps) {
  const steps = [
    {
      n: 1,
      label: "Registra tus productos",
      done: hasProducts,
    },
    {
      n: 2,
      label: "Define sus ingredientes",
      done: hasIngredients,
    },
    {
      n: 3,
      label: "Próximamente: completa la trazabilidad de tus productos",
      done: false,
    },
  ];

  const completedSteps = steps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <FlagIcon />
        </div>
        <h2 className="text-sm font-semibold text-text-primary">Primeros pasos</h2>
      </div>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.n} className="flex items-center gap-3">
            <div
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "border border-success-border bg-success-bg text-success"
                  : "border-2 border-border text-text-muted"
              }`}
            >
              {step.done ? "✓" : step.n}
            </div>
            <span
              className={`text-sm ${
                step.done
                  ? "text-text-secondary line-through"
                  : "text-text-primary"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-border pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-text-secondary">Progreso general</span>
          <span className="text-xs font-semibold text-brand-600">
            {progressPercent}%
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
