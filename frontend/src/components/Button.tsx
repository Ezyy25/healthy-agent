import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "brand" | "energy" | "outline";
}

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  brand: "bg-brand text-white shadow-[0_12px_24px_rgba(31,110,74,0.18)] hover:bg-brand-dark hover:-translate-y-0.5 active:translate-y-0",
  energy: "bg-energy text-white shadow-[0_12px_24px_rgba(226,112,58,0.18)] hover:brightness-95 hover:-translate-y-0.5 active:translate-y-0",
  outline: "border border-line/80 bg-white/60 text-ink hover:bg-white hover:-translate-y-0.5 active:translate-y-0",
};

export function Button({
  variant = "brand",
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold tracking-tight transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
