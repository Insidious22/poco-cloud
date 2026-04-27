import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const styles: Record<ButtonVariant, string> = {
  primary: "bg-cyanGlow text-ink hover:bg-signal",
  secondary: "bg-panelSoft text-slate-100 ring-1 ring-line hover:bg-slate-800",
  danger: "bg-danger text-white hover:bg-rose-400",
  ghost: "bg-transparent text-slate-300 hover:bg-white/5"
};

export const Button = ({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) => (
  <button
    className={clsx(
      "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
      styles[variant],
      className
    )}
    {...props}
  />
);
