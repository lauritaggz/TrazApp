import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import AppShell from "@/components/layout/AppShell";
import type { AppSection } from "@/components/layout/Sidebar";

export default function Dashboard() {
  const navigate = useNavigate();
  const { productor, logout } = useAuth();
  const [activePage, setActivePage] = useState<AppSection>("inicio");
  const producerName = productor?.nombre;
  const businessName = productor?.nombre_negocio;
  const firstName = producerName?.trim().split(/\s+/)[0] ?? "";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleNavigate(page: AppSection) {
    if (page === "perfil") {
      navigate("/perfil");
      return;
    }
    setActivePage(page);
  }

  return (
    <AppShell
      activePage={activePage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName}
      businessName={businessName}
    >
      {activePage === "inicio" && (
        <HomePage firstName={firstName} onNavigate={handleNavigate} />
      )}
      {activePage === "productos" && (
        <ComingSoonPage
          icon={<BoxIcon large />}
          title="Productos"
          description="Aquí podrás registrar y gestionar todos los productos que elaboras."
          onBack={() => setActivePage("inicio")}
        />
      )}
      {activePage === "ingredientes" && (
        <ComingSoonPage
          icon={<LeafIcon large />}
          title="Ingredientes"
          description="Aquí podrás registrar los ingredientes que utilizas en la elaboración de tus productos."
          onBack={() => setActivePage("inicio")}
        />
      )}
    </AppShell>
  );
}

function HomePage({
  firstName,
  onNavigate,
}: {
  firstName: string;
  onNavigate: (page: AppSection) => void;
}) {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="text-sm text-brand-600 font-medium mb-1">
          Panel de inicio
        </p>
        <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
          {firstName ? `Bienvenida, ${firstName}` : "Bienvenida"}
        </h1>
        <p className="text-text-secondary text-sm leading-relaxed">
          Desde aquí podrás gestionar la información de trazabilidad de tus
          productos.
        </p>
      </div>

      <div>
        <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <QuickCard
            icon={<BoxIcon large />}
            title="Productos"
            description="Registra y organiza los productos que elaboras."
            onClick={() => onNavigate("productos")}
          />
          <QuickCard
            icon={<LeafIcon large />}
            title="Ingredientes"
            description="Define los ingredientes que conforman tus recetas."
            onClick={() => onNavigate("ingredientes")}
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-8 w-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <FlagIcon />
          </div>
          <h2 className="text-base font-semibold text-text-primary">
            Primeros pasos
          </h2>
        </div>
        <ol className="space-y-4">
          {[
            {
              n: 1,
              title: "Registra tus productos",
              desc: "Crea los productos que elaboras con su nombre y descripción.",
            },
            {
              n: 2,
              title: "Define sus ingredientes",
              desc: "Asocia los ingredientes que componen cada producto.",
            },
            {
              n: 3,
              title: "Construye su trazabilidad",
              desc: "Documenta el origen y recorrido de cada ingrediente progresivamente.",
            },
          ].map((step) => (
            <li key={step.n} className="flex items-start gap-4">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-brand-200 text-xs font-semibold text-brand-600">
                {step.n}
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">
                  {step.title}
                </p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function QuickCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-card border border-border rounded-xl p-5 hover:border-brand-600 hover:shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
    >
      <div className="mb-3 h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600 group-hover:bg-brand-100 transition-colors">
        {icon}
      </div>
      <p className="font-semibold text-sm text-text-primary mb-1">{title}</p>
      <p className="text-xs text-text-secondary leading-relaxed">
        {description}
      </p>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:gap-2 transition-all">
        Ir a {title.toLowerCase()}
        <ArrowRightIcon />
      </div>
    </button>
  );
}

function ComingSoonPage({
  icon,
  title,
  description,
  onBack,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="19" y1="12" x2="5" y2="12" />
          <polyline points="12 19 5 12 12 5" />
        </svg>
        Volver al inicio
      </button>
      <div className="bg-card border border-border rounded-xl p-10 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
          {icon}
        </div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">
          {title}
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed mb-6">
          {description}
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 border border-brand-200 px-3 py-1 text-xs font-medium text-brand-600">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Próximamente disponible
        </span>
      </div>
    </div>
  );
}

function BoxIcon({ large }: { large?: boolean }) {
  return (
    <svg
      width={large ? 20 : 16}
      height={large ? 20 : 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function LeafIcon({ large }: { large?: boolean }) {
  return (
    <svg
      width={large ? 20 : 16}
      height={large ? 20 : 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 8C8 10 5.9 16.17 3.82 19.82A2 2 0 004 22h1c8.27 0 15-6.73 15-15v-1l-3 2z" />
      <line x1="7" y1="17" x2="13" y2="11" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
