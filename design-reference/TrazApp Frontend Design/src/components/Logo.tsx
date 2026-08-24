interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

export default function Logo({ size = "md", variant = "dark" }: LogoProps) {
  const sizes = {
    sm: { icon: 24, text: "text-base" },
    md: { icon: 32, text: "text-xl" },
    lg: { icon: 40, text: "text-2xl" },
  };

  const textColor = variant === "dark" ? "text-[#1f2933]" : "text-white";

  return (
    <div className="flex items-center gap-2.5">
      <TrazIcon size={sizes[size].icon} />
      <span className={`font-semibold tracking-tight ${sizes[size].text} ${textColor}`}>
        TrazApp
      </span>
    </div>
  );
}

function TrazIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="10" fill="#2f6b57" />
      {/* Chain/link nodes representing traceability */}
      <circle cx="12" cy="20" r="3.5" fill="white" fillOpacity="0.9" />
      <circle cx="20" cy="13" r="3.5" fill="white" fillOpacity="0.9" />
      <circle cx="28" cy="20" r="3.5" fill="white" fillOpacity="0.9" />
      <circle cx="20" cy="27" r="3.5" fill="white" fillOpacity="0.9" />
      {/* Connecting lines */}
      <line x1="12" y1="20" x2="20" y2="13" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="20" y1="13" x2="28" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="28" y1="20" x2="20" y2="27" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      <line x1="20" y1="27" x2="12" y2="20" stroke="white" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Center dot */}
      <circle cx="20" cy="20" r="2" fill="white" fillOpacity="0.6" />
    </svg>
  );
}
