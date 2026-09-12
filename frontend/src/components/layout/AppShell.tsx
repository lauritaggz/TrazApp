import { useState, type ReactNode } from "react";
import Sidebar, { type AppSection } from "@/components/layout/Sidebar";

interface AppShellProps {
  children: ReactNode;
  activePage: AppSection;
  onNavigate: (page: AppSection) => void;
  onLogout: () => void;
  producerName?: string;
  businessName?: string | null;
}

export default function AppShell({
  children,
  activePage,
  onNavigate,
  onLogout,
  producerName,
  businessName,
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card">
          <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-5 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface lg:hidden"
                aria-label="Abrir menú"
              >
                <MenuIcon />
              </button>
              <span className="hidden text-sm text-text-secondary sm:block">
                Panel de gestión
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden flex-col items-end sm:flex">
                {producerName ? (
                  <span className="text-sm font-medium leading-tight text-text-primary">
                    {producerName}
                  </span>
                ) : null}
                {businessName ? (
                  <span className="text-xs leading-tight text-text-secondary">
                    {businessName}
                  </span>
                ) : null}
                <span className="text-xs text-text-secondary">Productor</span>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {producerName?.trim()?.[0]?.toUpperCase() ?? <UserIcon />}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-5 lg:p-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
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
