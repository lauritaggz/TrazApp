import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";

export function useAppShell() {
  const navigate = useNavigate();
  const { productor, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return {
    productor,
    handleLogout,
    producerName: productor?.nombre,
    businessName: productor?.nombre_negocio,
  };
}
