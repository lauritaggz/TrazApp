import { Link } from "react-router-dom";
import Logo from "@/components/Logo";
import Button from "@/components/ui/Button";

interface RegisterSuccessProps {
  name: string;
}

export default function RegisterSuccess({ name }: RegisterSuccessProps) {
  return (
    <div className="min-h-screen flex bg-surface">
      <div className="hidden lg:flex flex-col justify-between w-[480px] shrink-0 bg-brand-600 px-12 py-14">
        <Logo size="lg" variant="light" />
        <div className="space-y-4">
          <p className="text-3xl font-semibold text-white leading-tight">
            Tu cuenta está lista.
          </p>
          <p className="text-panel-muted text-base leading-relaxed">
            Ya puedes iniciar sesión y comenzar a registrar tu información de
            trazabilidad.
          </p>
        </div>
        <span className="text-panel-faint text-xs">
          TrazApp · Trazabilidad para productores
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[400px] text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success-bg border border-success-border">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#027a48"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            Cuenta creada exitosamente
          </h2>
          <p className="text-sm text-text-secondary mb-8">
            Bienvenido a TrazApp,{" "}
            <strong className="text-text-primary">{name}</strong>. Ya puedes
            iniciar sesión con tu correo y contraseña.
          </p>
          <Link to="/login" className="block">
            <Button className="w-full">Ir al inicio de sesión</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
