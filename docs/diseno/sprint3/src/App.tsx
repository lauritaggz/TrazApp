import { useState } from "react";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ConsumerProduct from "@/pages/ConsumerProduct";

type Page = "login" | "register" | "dashboard" | "consumer-product";

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [producerName, setProducerName] = useState("");
  const [publicProductId, setPublicProductId] = useState(1);

  function handleLogin(name: string) {
    setProducerName(name);
    setPage("dashboard");
  }

  function handleLogout() {
    setProducerName("");
    setPage("login");
  }

  return (
    <>
      {page === "login" && (
        <Login onLogin={handleLogin} onGoRegister={() => setPage("register")} />
      )}
      {page === "register" && (
        <Register onGoLogin={() => setPage("login")} />
      )}
      {page === "dashboard" && (
        <Dashboard
          producerName={producerName}
          onLogout={handleLogout}
          onOpenPublic={(productId) => {
            setPublicProductId(productId);
            setPage("consumer-product");
          }}
        />
      )}
      {page === "consumer-product" && <ConsumerProduct productId={publicProductId} onBack={() => setPage("dashboard")} />}
    </>
  );
}
