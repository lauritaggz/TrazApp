import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import RegisterSuccess from "@/components/auth/RegisterSuccess";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import AuthLayout, { AuthHeading } from "@/components/auth/AuthLayout";
import { FlechaBoton } from "@/components/auth/FlechaBoton";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";
import { register as registerProductor } from "@/services/authService";
import { ApiError } from "@/types/auth";

export default function Register() {
  useDocumentTitle("Crear cuenta");
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key])
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "El nombre es obligatorio.";
    if (!form.businessName.trim()) {
      errs.businessName =
        "El nombre del negocio es obligatorio.";
    }
    if (!form.email) errs.email = "El correo electrónico es obligatorio.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Ingresa un correo electrónico válido.";
    if (!form.password) errs.password = "La contraseña es obligatoria.";
    else if (form.password.length < 8)
      errs.password = "La contraseña debe tener al menos 8 caracteres.";
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      await registerProductor({
        nombre: form.name.trim(),
        nombre_negocio: form.businessName.trim(),
        email: form.email,
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
        setGlobalError(err.message);
      } else {
        setGlobalError(
          "No se pudo crear la cuenta. Intenta de nuevo más tarde.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <RegisterSuccess name={form.name} businessName={form.businessName.trim()} />;
  }

  const largo = Math.min(form.password.length, 8);

  return (
    <AuthLayout
      panelTitle="Tu cocina, con el registro al día."
      panelText="Una cuenta por negocio. Tus productos, insumos y elaboraciones quedan guardados con su nombre."
    >
      <AuthHeading title="Crear cuenta">
        Crea tu cuenta de productor en TrazApp. Te pedimos lo justo para empezar.
      </AuthHeading>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {globalError && <Alert type="error">{globalError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nombre completo"
            type="text"
            placeholder="Tu nombre"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            error={fieldErrors.name}
            disabled={loading}
            autoComplete="name"
          />

          <Input
            label="Nombre del negocio"
            type="text"
            placeholder="Tu negocio"
            value={form.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            error={fieldErrors.businessName}
            disabled={loading}
            autoComplete="organization"
          />
        </div>

        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@correo.com"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          error={fieldErrors.email}
          disabled={loading}
          autoComplete="email"
        />

        <div className="space-y-2">
          <PasswordInput
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            error={fieldErrors.password}
            hint={!fieldErrors.password ? "Mínimo 8 caracteres." : undefined}
            disabled={loading}
            autoComplete="new-password"
          />
          {/* Avance hacia los 8 caracteres: solo visual, el texto de ayuda ya lo dice. */}
          <div aria-hidden="true" className="h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full w-full origin-left rounded-full transition-[transform,background-color] duration-300 ease-out ${
                largo >= 8 ? "bg-brand-600" : "bg-warning-border"
              }`}
              style={{ transform: `scaleX(${largo / 8})` }}
            />
          </div>
        </div>

        <Button type="submit" className="group mt-2 min-h-12 w-full text-[15px]" loading={loading}>
          {loading ? "Creando cuenta..." : "Crear cuenta"}
          {!loading && <FlechaBoton />}
        </Button>
      </form>

      <p className="mt-8 text-center text-[15px] text-text-secondary">
        ¿Ya tienes una cuenta?{" "}
        <Link
          to="/login"
          className="font-semibold text-accent-strong underline-offset-2 transition-colors hover:underline"
        >
          Iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
