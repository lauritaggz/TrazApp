interface DashboardHeaderProps {
  firstName: string;
  businessName?: string | null;
}

export default function DashboardHeader({
  firstName,
  businessName,
}: DashboardHeaderProps) {
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="relative overflow-hidden rounded-2xl bg-brand-600 px-7 py-6">
      <svg
        className="absolute right-0 top-0 pointer-events-none opacity-10"
        width="260"
        height="140"
        viewBox="0 0 260 140"
        aria-hidden
      >
        <circle cx="200" cy="30" r="60" fill="white" />
        <circle cx="240" cy="100" r="40" fill="white" />
        <circle cx="130" cy="80" r="30" fill="white" />
        <line x1="200" y1="30" x2="240" y2="100" stroke="white" strokeWidth="2" />
        <line x1="200" y1="30" x2="130" y2="80" stroke="white" strokeWidth="2" />
      </svg>
      <p className="mb-1 text-xs font-medium capitalize text-panel-muted">{today}</p>
      <h1 className="mb-1 text-2xl font-semibold text-white">
        Bienvenida, {firstName} 👋
      </h1>
      {businessName?.trim() ? (
        <p className="mb-1 text-sm font-medium text-panel-soft">{businessName.trim()}</p>
      ) : null}
      <p className="max-w-sm text-sm text-panel-soft">
        Desde aquí podés gestionar la información base de tus productos e
        ingredientes y mantenerla actualizada.
      </p>
    </div>
  );
}
