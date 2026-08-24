import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import Logo from "@/components/Logo";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";
import { ApiError } from "@/types/auth";

export default function Login() {
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
    <div className="min-h-screen flex bg-surface">
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-brand-600 px-12 py-14">
        <Logo size="lg" variant="light" />

        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-white leading-tight">
              Trazabilidad organizada,
              <br />
              información confiable.
            </h1>
            <p className="text-panel-muted text-base leading-relaxed">
              Gestiona el origen y recorrido de tus productos de forma sencilla,
              desde un solo lugar.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Registra tus productos e ingredientes",
              "Construye la trazabilidad paso a paso",
              "Comparte información confiable con tus clientes",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <CheckIcon />
                </div>
                <span className="text-sm text-panel-soft leading-relaxed">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-panel-faint text-xs">
          <NodePattern />
          <span>TrazApp · Trazabilidad para productores</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="mb-10 lg:hidden">
          <Logo size="md" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-text-primary mb-1">
              Iniciar sesión
            </h2>
            <p className="text-sm text-text-secondary">
              Accede a tu panel de gestión de trazabilidad.
            </p>
          </div>

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

            <Button type="submit" className="w-full mt-2" loading={loading}>
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            ¿Todavía no tienes una cuenta?{" "}
            <Link
              to="/register"
              className="font-medium text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline transition-colors"
            >
              Crear cuenta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
      <path
        d="M2 6l3 3 5-5"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NodePattern() {
  return (
    <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
      <circle cx="4" cy="8" r="3" fill="white" fillOpacity="0.3" />
      <circle cx="16" cy="4" r="3" fill="white" fillOpacity="0.3" />
      <circle cx="28" cy="8" r="3" fill="white" fillOpacity="0.3" />
      <line
        x1="4"
        y1="8"
        x2="16"
        y2="4"
        stroke="white"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      <line
        x1="16"
        y1="4"
        x2="28"
        y2="8"
        stroke="white"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
    </svg>
  );
}
