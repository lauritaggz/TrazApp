import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import type { AppSection } from "@/components/layout/Sidebar";

export function useAppShell() {
  const navigate = useNavigate();
  const { productor, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function handleNavigate(page: AppSection) {
    switch (page) {
      case "inicio":
        navigate("/dashboard");
        break;
      case "productos":
        navigate("/productos");
        break;
      case "ingredientes":
        navigate("/ingredientes");
        break;
      case "perfil":
        navigate("/perfil");
        break;
    }
  }

  return {
    productor,
    handleLogout,
    handleNavigate,
    producerName: productor?.nombre,
    businessName: productor?.nombre_negocio,
  };
}
