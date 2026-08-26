import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/auth/AuthContext";
import AppShell from "@/components/layout/AppShell";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAppShell } from "@/hooks/useAppShell";
import { updateProfile } from "@/services/authService";
import { ApiError } from "@/types/auth";

export default function Profile() {
  const { productor, setProductor } = useAuth();
  const { handleLogout, handleNavigate, producerName, businessName } =
    useAppShell();
  const [form, setForm] = useState({
    name: productor?.nombre ?? "",
    businessName: productor?.nombre_negocio ?? "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productor) return;
    setForm({
      name: productor.nombre,
      businessName: productor.nombre_negocio ?? "",
    });
  }, [productor]);

  function update(key: "name" | "businessName", value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio.";
    if (!form.businessName.trim()) {
      errs.businessName =
        "El nombre del negocio o emprendimiento es obligatorio.";
    }
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError("");
    setSuccessMessage("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      const updated = await updateProfile({
        nombre: form.name.trim(),
        nombre_negocio: form.businessName.trim(),
      });
      setProductor(updated);
      setSuccessMessage("Perfil actualizado correctamente.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
        setGlobalError(err.message);
      } else {
        setGlobalError(
          "No se pudo guardar el perfil. Intenta de nuevo más tarde.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      activePage="perfil"
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      producerName={producerName ?? productor?.nombre}
      businessName={businessName ?? productor?.nombre_negocio}
    >
      <div className="max-w-xl space-y-6">
        <div>
          <p className="text-sm text-brand-600 font-medium mb-1">Cuenta</p>
          <h1 className="text-2xl font-semibold text-text-primary mb-1.5">
            Mi perfil
          </h1>
          <p className="text-text-secondary text-sm leading-relaxed">
            Actualiza tu nombre y el de tu negocio o emprendimiento. El correo
            se usa para iniciar sesión y no se puede modificar aquí.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-xl p-6 space-y-4"
          noValidate
        >
          {globalError && <Alert type="error">{globalError}</Alert>}
          {successMessage && <Alert type="success">{successMessage}</Alert>}

          <Input
            label="Nombre"
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            error={fieldErrors.name}
            disabled={loading}
            autoComplete="name"
          />

          <Input
            label="Nombre del negocio"
            type="text"
            value={form.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            error={fieldErrors.businessName}
            disabled={loading}
            autoComplete="organization"
          />

          <Input
            label="Correo electrónico"
            type="email"
            value={productor?.email ?? ""}
            disabled
            readOnly
          />

          <Button type="submit" className="w-full sm:w-auto" loading={loading}>
            {loading ? "Guardando..." : "Guardar cambios"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
