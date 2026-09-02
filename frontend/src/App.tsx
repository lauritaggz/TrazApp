import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute } from "@/auth/ProtectedRoute";
import Dashboard from "@/pages/Dashboard";
import IngredientDetail from "@/pages/IngredientDetail";
import IngredientEdit from "@/pages/IngredientEdit";
import IngredientNew from "@/pages/IngredientNew";
import Ingredients from "@/pages/Ingredients";
import Login from "@/pages/Login";
import Profile from "@/pages/Profile";
import ProductDetail from "@/pages/ProductDetail";
import ProductEdit from "@/pages/ProductEdit";
import ProductNew from "@/pages/ProductNew";
import Products from "@/pages/Products";
import Register from "@/pages/Register";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/productos/nuevo" element={<ProductNew />} />
        <Route path="/productos/:id/editar" element={<ProductEdit />} />
        <Route path="/productos/:id" element={<ProductDetail />} />
        <Route path="/ingredientes" element={<Ingredients />} />
        <Route path="/ingredientes/nuevo" element={<IngredientNew />} />
        <Route path="/ingredientes/:id/editar" element={<IngredientEdit />} />
        <Route path="/ingredientes/:id" element={<IngredientDetail />} />
        <Route path="/perfil" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
