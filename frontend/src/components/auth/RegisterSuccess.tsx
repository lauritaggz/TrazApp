import { Link } from "react-router-dom";
import AuthLayout, { AuthHeading } from "@/components/auth/AuthLayout";
import { FlechaBoton } from "@/components/auth/FlechaBoton";

interface RegisterSuccessProps {
  name: string;
  businessName?: string;
}

const PRIMEROS_PASOS = [
  "Crea tu primer producto",
  "Define sus ingredientes",
  "Registra tu primera elaboración",
];

export default function RegisterSuccess({ name, businessName }: RegisterSuccessProps) {
  return (
    <AuthLayout
      panelTitle="Listo. El primer tramo del recorrido."
      panelText="Desde ahora, cada insumo y cada elaboración que registres queda unido a lo que vendes."
    >
      <span
        aria-hidden="true"
        className="sello mb-6 flex h-[76px] w-[76px] items-center justify-center rounded-3xl bg-brand-600 text-on-brand"
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5 10 17.5 19 7" />
        </svg>
      </span>

      <AuthHeading title="Cuenta creada exitosamente">
        Te damos la bienvenida a TrazApp,{" "}
        <strong className="font-semibold text-text-primary">{name}</strong>. Ya puedes
        iniciar sesión con tu correo y contraseña.
        {businessName ? (
          <>
            {" "}
            Tu negocio, <strong className="font-semibold text-text-primary">{businessName}</strong>,
            ya tiene su cuaderno.
          </>
        ) : null}
      </AuthHeading>

      <p className="mb-3 text-sm font-semibold text-text-primary">Tus primeros pasos al entrar</p>
      <ol className="mb-8 space-y-2.5">
        {PRIMEROS_PASOS.map((paso, index) => (
          <li
            key={paso}
            className="flex items-center gap-3 rounded-xl bg-panel px-3.5 py-3 text-[15px] text-text-primary"
          >
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card font-mono text-xs text-text-secondary"
            >
              {index + 1}
            </span>
            {paso}
          </li>
        ))}
      </ol>

      <Link
        to="/login"
        className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-[15px] font-semibold text-on-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_6px_16px_-8px_var(--color-brand-600)] transition-[background-color,transform] duration-150 hover:bg-brand-700 active:translate-y-px active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Ir al inicio de sesión
        <FlechaBoton />
      </Link>
    </AuthLayout>
  );
}
