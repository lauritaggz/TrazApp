import { useState, type FormEvent } from "react";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";
import { Input, PasswordInput } from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";

interface RegisterProps {
  onGoLogin: () => void;
}

export default function Register({ onGoLogin }: RegisterProps) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [globalError, setGlobalError] = useState("");

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
    await new Promise((r) => setTimeout(r, 1600));
    setLoading(false);

    // Simulate existing email error
    if (form.email === "usado@ejemplo.com") {
      setGlobalError("Ya existe una cuenta registrada con este correo electrónico.");
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="min-h-screen flex bg-[#f7f8f7]">
        <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-[#2f6b57] px-12 py-14">
          <Logo size="lg" variant="light" />
          <div className="space-y-4">
            <p className="text-3xl font-semibold text-white leading-tight">
              Tu cuenta está lista.
            </p>
            <p className="text-[#a8cfc2] text-base leading-relaxed">
              Ya puedes iniciar sesión y comenzar a registrar tu información de trazabilidad.
            </p>
          </div>
          <span className="text-[#6aab93] text-xs">TrazApp · Trazabilidad para productores</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[400px] text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#ecfdf3] border border-[#a9efc5]">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#027a48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold text-[#1f2933] mb-2">
              Cuenta creada exitosamente
            </h2>
            <p className="text-sm text-[#667085] mb-8">
              Bienvenido a TrazApp, <strong className="text-[#1f2933]">{form.name}</strong>. Ya puedes iniciar sesión con tu correo y contraseña.
            </p>
            <Button className="w-full" onClick={onGoLogin}>
              Ir al inicio de sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f7f8f7]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-[#2f6b57] px-12 py-14">
        <Logo size="lg" variant="light" />
        <div className="space-y-4">
          <p className="text-3xl font-semibold text-white leading-tight">
            Empieza a construir<br />
            tu historia de trazabilidad.
          </p>
          <p className="text-[#a8cfc2] text-base leading-relaxed">
            Registra tu cuenta y comienza a documentar el origen y recorrido de tus productos de forma sencilla.
          </p>
        </div>
        <span className="text-[#6aab93] text-xs">TrazApp · Trazabilidad para productores</span>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="mb-10 lg:hidden">
          <Logo size="md" />
        </div>

        <div className="w-full max-w-[400px]">
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[#1f2933] mb-1">
              Crear cuenta
            </h2>
            <p className="text-sm text-[#667085]">
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

            <Button
              type="submit"
              className="w-full mt-2"
              loading={loading}
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#667085]">
            ¿Ya tienes una cuenta?{" "}
            <button
              onClick={onGoLogin}
              className="font-medium text-[#2f6b57] hover:text-[#255747] underline-offset-2 hover:underline transition-colors"
            >
              Iniciar sesión
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
