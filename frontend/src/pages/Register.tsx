import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import RegisterSuccess from "@/components/auth/RegisterSuccess";
import Logo from "@/components/Logo";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [globalError, setGlobalError] = useState("");

  // T12-06: activar loading/success alrededor de POST /auth/register.
  const loading = false;
  const success = false;

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
    if (!form.email) errs.email = "El correo electrónico es obligatorio.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = "Ingresa un correo electrónico válido.";
    if (!form.password) errs.password = "La contraseña es obligatoria.";
    else if (form.password.length < 8)
      errs.password = "La contraseña debe tener al menos 8 caracteres.";
    return errs;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setGlobalError("");
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    // T12-06: conectar con POST /auth/register y mostrar RegisterSuccess.
  }

  if (success) {
    return <RegisterSuccess name={form.name} />;
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-brand-600 px-12 py-14">
        <Logo size="lg" variant="light" />
        <div className="space-y-4">
          <p className="text-3xl font-semibold text-white leading-tight">
            Empieza a construir
            <br />
            tu historia de trazabilidad.
          </p>
          <p className="text-panel-muted text-base leading-relaxed">
            Registra tu cuenta y comienza a documentar el origen y recorrido de
            tus productos de forma sencilla.
          </p>
        </div>
        <span className="text-panel-faint text-xs">
          TrazApp · Trazabilidad para productores
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="mb-10 lg:hidden">
          <Logo size="md" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-text-primary mb-1">
              Crear cuenta
            </h2>
            <p className="text-sm text-text-secondary">
              Crea tu cuenta de productor en TrazApp.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {globalError && <Alert type="error">{globalError}</Alert>}

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
              label="Correo electrónico"
              type="email"
              placeholder="tu@correo.com"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              error={fieldErrors.email}
              disabled={loading}
              autoComplete="email"
            />

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

            <Button type="submit" className="w-full mt-2" loading={loading}>
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            ¿Ya tienes una cuenta?{" "}
            <Link
              to="/login"
              className="font-medium text-brand-600 hover:text-brand-700 underline-offset-2 hover:underline transition-colors"
            >
              Iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
