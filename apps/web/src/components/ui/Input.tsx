import { clsx } from "clsx";
import type { InputHTMLAttributes } from "react";

export const Input = ({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={clsx(
      "h-11 w-full rounded-md border border-line bg-ink/70 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyanGlow focus:ring-2 focus:ring-cyanGlow/20",
      className
    )}
    {...props}
  />
);
