import { useState } from "react";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";

type Page = "login" | "register" | "dashboard";

export default function App() {
  const [page, setPage] = useState<Page>("login");
  const [producerName, setProducerName] = useState("");

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
        <Dashboard producerName={producerName} onLogout={handleLogout} />
      )}
    </>
  );
}
