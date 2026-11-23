interface DashboardGettingStartedProps {
  hasProducts: boolean;
  hasIngredients: boolean;
  /** There is at least one elaboración (draft or finished). */
  hasElaboraciones: boolean;
}

export default function DashboardGettingStarted({
  hasProducts,
  hasIngredients,
  hasElaboraciones,
}: DashboardGettingStartedProps) {
  const steps = [
    {
      n: 1,
      label: "Crea tus productos",
      done: hasProducts,
    },
    {
      n: 2,
      label: "Define sus ingredientes",
      done: hasIngredients,
    },
    {
      n: 3,
      label: "Registra tu primera elaboración",
      done: hasElaboraciones,
    },
  ];

  const completedSteps = steps.filter((step) => step.done).length;
  const progressPercent = Math.round((completedSteps / steps.length) * 100);

  return (
    <section
      aria-labelledby="dashboard-primeros-pasos"
      className="rounded-2xl border border-wheat-deep/60 bg-wheat p-5 sm:p-6"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id="dashboard-primeros-pasos" className="text-lg font-bold text-text-primary">
          Primeros pasos
        </h2>
        <span className="text-[13px] font-medium tabular-nums text-text-secondary">
          {completedSteps} de {steps.length}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Avance de primeros pasos"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completedSteps}
        className="mb-4 h-2 w-full overflow-hidden rounded-full bg-card/70"
      >
        {/* Indicador pequeño y aislado: se anima su escala, no su ancho. */}
        <div
          className="h-full w-full origin-left rounded-full bg-brand-600 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `scaleX(${progressPercent / 100})` }}
        />
      </div>
      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.n} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-brand-600 text-on-brand"
                  : "border-2 border-wheat-deep bg-card/60 text-text-muted"
              }`}
            >
              {step.done ? <CheckIcon /> : step.n}
            </span>
            <span
              className={`text-sm ${
                step.done
                  ? "text-text-secondary line-through decoration-wheat-deep"
                  : "font-semibold text-text-primary"
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 flex items-center justify-between border-t border-wheat-deep/60 pt-3 text-[13px] text-text-secondary">
        Progreso general
        <span className="font-semibold tabular-nums text-accent-strong">{progressPercent}%</span>
      </p>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5 10 17 19 7.5" />
    </svg>
  );
}
