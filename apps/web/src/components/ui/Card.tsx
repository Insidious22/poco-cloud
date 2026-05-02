import { clsx } from "clsx";

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={clsx("min-w-0 rounded-lg border border-line bg-panel/88 p-4 shadow-glow sm:p-5", className)}>
    {children}
  </section>
);
