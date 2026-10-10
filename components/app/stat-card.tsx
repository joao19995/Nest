import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/components/cn";
import { Card } from "@/components/ui/card";

type StatCardVariant = "neutral" | "muted" | "primary";

const cardClasses: Record<StatCardVariant, string> = {
  neutral: "bg-white",
  muted: "bg-mint-soft border-[#cfe0d4]",
  primary: "bg-ink border-ink text-white shadow-[0_8px_24px_rgb(23_55_45/25%)]",
};

const eyebrowClasses: Record<StatCardVariant, string> = {
  neutral: "text-primary",
  muted: "text-primary-dark",
  primary: "text-mint",
};

const noteClasses: Record<StatCardVariant, string> = {
  neutral: "text-muted",
  muted: "text-muted",
  primary: "text-white/70",
};

const iconChipClasses: Record<StatCardVariant, string> = {
  neutral: "bg-terra-soft text-terra-dark",
  muted: "bg-white/70 text-primary-dark",
  primary: "bg-white/10 text-mint",
};

export function StatCard({
  eyebrow,
  value,
  note,
  variant = "neutral",
  icon: Icon,
  className,
}: {
  eyebrow: string;
  value: React.ReactNode;
  note?: string;
  variant?: StatCardVariant;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Card className={cn("min-h-[125px] px-[25px] pb-5 pt-[23px]", cardClasses[variant], className)}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("m-0 text-[10px] font-bold uppercase tracking-[1.5px]", eyebrowClasses[variant])}>
          {eyebrow}
        </p>
        {Icon && (
          <span className={cn("grid h-8 w-8 place-items-center rounded-[10px]", iconChipClasses[variant])}>
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-2 font-display font-bold tracking-[-0.4px] tabular-nums",
          variant === "primary" ? "text-[26px]" : "text-[22px]",
          variant === "primary" && "text-white",
        )}
      >
        {value}
      </div>
      {note && <p className={cn("m-0 mt-1 text-xs", noteClasses[variant])}>{note}</p>}
    </Card>
  );
}
