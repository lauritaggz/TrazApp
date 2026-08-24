import { useState, type ReactNode } from "react";
import Sidebar, {
  type DashboardSection,
} from "@/components/layout/Sidebar";

interface AppShellProps {
  children: ReactNode;
  activePage: DashboardSection;
  onNavigate: (page: DashboardSection) => void;
  onLogout: () => void;
  producerName?: string;
}

export default function AppShell({
  children,
  activePage,
  onNavigate,
  onLogout,
  producerName,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0">
        <header className="h-16 flex items-center justify-between px-5 lg:px-8 bg-card border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-md text-text-secondary hover:bg-surface transition-colors"
              aria-label="Abrir menú"
            >
              <MenuIcon />
            </button>
            <span className="text-sm text-text-secondary hidden sm:block">
              Panel de gestión
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end hidden sm:flex">
              {producerName ? (
                <span className="text-sm font-medium text-text-primary leading-tight">
                  {producerName}
                </span>
              ) : null}
              <span className="text-xs text-text-secondary">Productor</span>
            </div>
            <div className="h-9 w-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {producerName?.trim()?.[0]?.toUpperCase() ?? (
                <UserIcon />
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function UserIcon() {
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
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
