import { useState } from "react";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";

interface DashboardProps {
  producerName: string;
  onLogout: () => void;
}

type ActivePage = "inicio" | "productos" | "ingredientes";

export default function Dashboard({ producerName, onLogout }: DashboardProps) {
  const [activePage, setActivePage] = useState<ActivePage>("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const firstName = producerName.split(" ")[0];

  return (
    <div className="min-h-screen bg-[#f7f8f7] flex">
      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 flex flex-col
          w-[240px] bg-white border-r border-[#e5e7e5]
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center h-16 px-5 border-b border-[#e5e7e5] shrink-0">
          <Logo size="sm" />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <NavItem
            icon={<HomeIcon />}
            label="Inicio"
            active={activePage === "inicio"}
            onClick={() => { setActivePage("inicio"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<BoxIcon />}
            label="Productos"
            active={activePage === "productos"}
            onClick={() => { setActivePage("productos"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<LeafIcon />}
            label="Ingredientes"
            active={activePage === "ingredientes"}
            onClick={() => { setActivePage("ingredientes"); setSidebarOpen(false); }}
          />
        </nav>

        {/* Separator + logout */}
        <div className="px-3 pb-4 border-t border-[#e5e7e5] pt-3 shrink-0">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm text-[#667085] hover:text-[#b42318] hover:bg-[#fef3f2] transition-colors group"
          >
            <LogoutIcon />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-5 lg:px-8 bg-white border-b border-[#e5e7e5] shrink-0">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-[#667085] hover:bg-[#f7f8f7] transition-colors"
              aria-label="Abrir menú"
            >
              <MenuIcon />
            </button>
            <span className="text-sm text-[#667085] hidden sm:block">
              Panel de gestión
            </span>
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end hidden sm:flex">
              <span className="text-sm font-medium text-[#1f2933] leading-tight">{producerName}</span>
              <span className="text-xs text-[#667085]">Productor</span>
            </div>
            <div className="h-9 w-9 rounded-full bg-[#2f6b57] flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {firstName[0]}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          {activePage === "inicio" && (
            <HomePage firstName={firstName} onNavigate={setActivePage} />
          )}
          {activePage === "productos" && (
            <ComingSoonPage
              icon={<BoxIcon />}
              title="Productos"
              description="Aquí podrás registrar y gestionar todos los productos que elaboras."
              onBack={() => setActivePage("inicio")}
            />
          )}
          {activePage === "ingredientes" && (
            <ComingSoonPage
              icon={<LeafIcon />}
              title="Ingredientes"
              description="Aquí podrás registrar los ingredientes que utilizas en la elaboración de tus productos."
              onBack={() => setActivePage("inicio")}
            />
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── Home page ─── */
function HomePage({
  firstName,
  onNavigate,
}: {
  firstName: string;
  onNavigate: (p: ActivePage) => void;
}) {
  return (
    <div className="max-w-3xl space-y-8">
      {/* Welcome */}
      <div>
        <p className="text-sm text-[#2f6b57] font-medium mb-1">Panel de inicio</p>
        <h1 className="text-2xl font-semibold text-[#1f2933] mb-1.5">
          Bienvenida, {firstName}
        </h1>
        <p className="text-[#667085] text-sm leading-relaxed">
          Desde aquí podrás gestionar la información de trazabilidad de tus productos.
        </p>
      </div>

      {/* Quick access cards */}
      <div>
        <h2 className="text-xs font-semibold text-[#667085] uppercase tracking-wider mb-3">
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

      {/* Getting started */}
      <div className="bg-white rounded-xl border border-[#e5e7e5] p-6">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="h-8 w-8 rounded-lg bg-[#f0f7f4] flex items-center justify-center">
            <FlagIcon />
          </div>
          <h2 className="text-base font-semibold text-[#1f2933]">Primeros pasos</h2>
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
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#b3dbd0] text-xs font-semibold text-[#2f6b57]">
                {step.n}
              </div>
              <div>
                <p className="text-sm font-medium text-[#1f2933]">{step.title}</p>
                <p className="text-xs text-[#667085] mt-0.5 leading-relaxed">{step.desc}</p>
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
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white border border-[#e5e7e5] rounded-xl p-5 hover:border-[#2f6b57] hover:shadow-sm transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6b57]"
    >
      <div className="mb-3 h-10 w-10 rounded-lg bg-[#f0f7f4] flex items-center justify-center text-[#2f6b57] group-hover:bg-[#d9ede6] transition-colors">
        {icon}
      </div>
      <p className="font-semibold text-sm text-[#1f2933] mb-1">{title}</p>
      <p className="text-xs text-[#667085] leading-relaxed">{description}</p>
      <div className="mt-3 flex items-center gap-1 text-xs font-medium text-[#2f6b57] group-hover:gap-2 transition-all">
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
  icon: React.ReactNode;
  title: string;
  description: string;
  onBack: () => void;
}) {
  return (
    <div className="max-w-lg">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[#667085] hover:text-[#1f2933] mb-6 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Volver al inicio
      </button>
      <div className="bg-white border border-[#e5e7e5] rounded-xl p-10 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-[#f0f7f4] flex items-center justify-center text-[#2f6b57]">
          {icon}
        </div>
        <h1 className="text-xl font-semibold text-[#1f2933] mb-2">{title}</h1>
        <p className="text-sm text-[#667085] leading-relaxed mb-6">{description}</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f7f4] border border-[#b3dbd0] px-3 py-1 text-xs font-medium text-[#2f6b57]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          Próximamente disponible
        </span>
      </div>
    </div>
  );
}

/* ─── Nav item ─── */
function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
        ${active
          ? "bg-[#f0f7f4] text-[#2f6b57]"
          : "text-[#667085] hover:bg-[#f7f8f7] hover:text-[#1f2933]"
        }
      `}
    >
      <span className={active ? "text-[#2f6b57]" : "text-[#9aa4a8]"}>{icon}</span>
      {label}
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#2f6b57]" />
      )}
    </button>
  );
}

/* ─── Icons ─── */
function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function BoxIcon({ large }: { large?: boolean }) {
  return (
    <svg width={large ? 20 : 16} height={large ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function LeafIcon({ large }: { large?: boolean }) {
  return (
    <svg width={large ? 20 : 16} height={large ? 20 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8C8 10 5.9 16.17 3.82 19.82A2 2 0 004 22h1c8.27 0 15-6.73 15-15v-1l-3 2z" />
      <line x1="7" y1="17" x2="13" y2="11" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
