import {
  type InputHTMLAttributes,
  type ReactNode,
  useState,
  forwardRef,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, id, className = "", ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#1f2933]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute inset-y-0 left-3 flex items-center text-[#667085] pointer-events-none">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full rounded-lg border bg-white text-sm text-[#1f2933] placeholder:text-[#9aa4a8]
              px-3 py-2.5 transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-[#2f6b57] focus:border-transparent
              disabled:opacity-50 disabled:bg-[#f7f8f7] disabled:cursor-not-allowed
              ${leftIcon ? "pl-10" : ""}
              ${error
                ? "border-[#b42318] focus:ring-[#b42318] bg-[#fef3f2]"
                : "border-[#e5e7e5] hover:border-[#b0b7b0]"
              }
              ${className}
            `}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-[#b42318] flex items-center gap-1">
            <ErrorIcon />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[#667085]">{hint}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

interface PasswordInputProps extends Omit<InputProps, "type"> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id || "password";
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#1f2933]"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            className={`
              w-full rounded-lg border bg-white text-sm text-[#1f2933] placeholder:text-[#9aa4a8]
              px-3 py-2.5 pr-10 transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-[#2f6b57] focus:border-transparent
              disabled:opacity-50 disabled:bg-[#f7f8f7] disabled:cursor-not-allowed
              ${error
                ? "border-[#b42318] focus:ring-[#b42318] bg-[#fef3f2]"
                : "border-[#e5e7e5] hover:border-[#b0b7b0]"
              }
              ${className}
            `}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-[#667085] hover:text-[#1f2933] transition-colors"
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {error && (
          <p className="text-xs text-[#b42318] flex items-center gap-1">
            <ErrorIcon />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs text-[#667085]">{hint}</p>
        )}
      </div>
    );
  }
);
PasswordInput.displayName = "PasswordInput";

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
