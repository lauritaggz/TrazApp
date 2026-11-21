import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import AuthLayout, { AuthHeading } from "@/components/auth/AuthLayout";
import { FlechaBoton } from "@/components/auth/FlechaBoton";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";
import { ApiError } from "@/types/auth";

export default function Login() {
  useDocumentTitle("Iniciar sesión");
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  function validate() {
    const errs: typeof fieldErrors = {};
    if (!email) errs.email = "El correo electrónico es obligatorio.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      errs.email = "Ingresa un correo electrónico válido.";
    if (!password) errs.password = "La contraseña es obligatoria.";
    return errs;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          setFieldErrors(err.fieldErrors);
        }
        setError(
          err.status === 401
            ? "Credenciales inválidas"
            : err.message,
        );
      } else {
        setError("No se pudo iniciar sesión. Intenta de nuevo más tarde.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      panelTitle="Del insumo al cliente, sin perder el hilo."
      panelText="Entra para seguir con tus elaboraciones en curso y revisar lo que quedó pendiente."
    >
      <AuthHeading title="Iniciar sesión">
        Accede a tu panel de gestión de trazabilidad.
      </AuthHeading>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert type="error">{error}</Alert>}

        <Input
          label="Correo electrónico"
          type="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldErrors.email)
              setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={fieldErrors.email}
          disabled={loading}
          autoComplete="email"
        />

        <PasswordInput
          label="Contraseña"
          placeholder="Tu contraseña"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldErrors.password)
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={fieldErrors.password}
          disabled={loading}
          autoComplete="current-password"
        />

        <Button type="submit" className="group mt-2 min-h-12 w-full text-[15px]" loading={loading}>
          {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          {!loading && <FlechaBoton />}
        </Button>
      </form>

      <p className="mt-8 text-center text-[15px] text-text-secondary">
        ¿Todavía no tienes una cuenta?{" "}
        <Link
          to="/register"
          className="font-semibold text-accent-strong underline-offset-2 transition-colors hover:underline"
        >
          Crear cuenta
        </Link>
      </p>
    </AuthLayout>
  );
}

