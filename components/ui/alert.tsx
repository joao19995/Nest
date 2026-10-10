import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/cn";

const alertVariants = cva("rounded-lg border border-solid px-3 py-2.5 text-[12px] leading-relaxed", {
  variants: {
    variant: {
      default: "border-line bg-white text-ink-soft",
      muted: "border-line bg-paper text-muted",
      info: "border-[#bfe3d2] bg-mint-soft text-primary-dark",
      destructive: "border-[#f0d0d0] bg-[#fff0ef] text-[#a33a32]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, role, ...props }: AlertProps) {
  return (
    <div
      role={role ?? (variant === "destructive" ? "alert" : undefined)}
      className={cn(alertVariants({ variant }), "m-0", className)}
      {...props}
    />
  );
}
