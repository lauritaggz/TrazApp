import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import Logo from "@/components/Logo";

export function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <AuthLoadingScreen />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 px-6">
      <Logo size="md" />
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <span className="h-4 w-4 rounded-full border-2 border-brand-200 border-t-brand-600 animate-spin" />
        Cargando sesión...
      </div>
    </div>
  );
}
