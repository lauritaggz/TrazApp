import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    disabled,
    children,
    className = "",
    ...props
  },
  ref,
) {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 font-semibold text-sm rounded-xl px-4 py-2.5 transition-[background-color,border-color,box-shadow,transform] duration-150 ease-out active:translate-y-px active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 select-none";

  const variants = {
    primary:
      "bg-brand-600 text-on-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_6px_16px_-8px_var(--color-brand-600)] hover:bg-brand-700 focus-visible:ring-accent active:bg-brand-800",
    secondary:
      "bg-card text-text-primary border border-border hover:border-border-strong focus-visible:ring-accent active:bg-panel",
    ghost:
      "text-accent hover:bg-brand-50 focus-visible:ring-accent active:bg-brand-100",
  };

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
});

export default Button;

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
