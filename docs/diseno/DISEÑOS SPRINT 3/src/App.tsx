import { useEffect, useState } from "react";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ConsumerProduct from "@/pages/ConsumerProduct";

type Page = "login" | "register" | "dashboard" | "consumer-product";

export default function App() {
  const publicProductFromHash = () => {
    const match = window.location.hash.match(/^#\/p\/(\d+)$/);
    return match ? Number(match[1]) : null;
  };
  const initialPublicProduct = publicProductFromHash();
  const [page, setPage] = useState<Page>(initialPublicProduct ? "consumer-product" : "login");
  const [producerName, setProducerName] = useState("");
  const [publicProductId, setPublicProductId] = useState(initialPublicProduct ?? 1);
  const [isPublicPreview, setIsPublicPreview] = useState(false);

  useEffect(() => {
    function openPublicHash() {
      const productId = publicProductFromHash();
      if (!productId) return;
      setPublicProductId(productId);
      setIsPublicPreview(false);
      setPage("consumer-product");
    }
    window.addEventListener("hashchange", openPublicHash);
    return () => window.removeEventListener("hashchange", openPublicHash);
  }, []);

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
            setIsPublicPreview(true);
            setPage("consumer-product");
          }}
        />
      )}
      {page === "consumer-product" && (
        <ConsumerProduct
          productId={publicProductId}
          preview={isPublicPreview}
          onBack={() => {
            if (isPublicPreview) {
              setPage("dashboard");
            } else {
              window.location.hash = "";
              setPage("login");
            }
          }}
        />
      )}
    </>
  );
}
