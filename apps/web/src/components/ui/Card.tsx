import { clsx } from "clsx";

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <section className={clsx("rounded-lg border border-line bg-panel/88 p-5 shadow-glow", className)}>
    {children}
  </section>
);
