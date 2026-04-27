import { clsx } from "clsx";

export const Badge = ({
  children,
  tone = "neutral"
}: {
  children: React.ReactNode;
  tone?: "success" | "danger" | "neutral" | "warning";
}) => (
  <span
    className={clsx(
      "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
      tone === "success" && "bg-emerald-400/12 text-emerald-300",
      tone === "danger" && "bg-rose-400/12 text-rose-300",
      tone === "warning" && "bg-amber-400/12 text-amber-200",
      tone === "neutral" && "bg-slate-400/12 text-slate-300"
    )}
  >
    {children}
  </span>
);
