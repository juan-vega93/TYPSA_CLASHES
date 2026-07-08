import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  right,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]",
        className
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-xs text-muted-foreground/80">{subtitle}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}