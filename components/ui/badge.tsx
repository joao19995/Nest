import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
  {
    variants: {
      variant: {
        open: "bg-mint-soft text-primary-dark",
        closed: "bg-terra-soft text-terra-dark",
        muted: "bg-line-soft text-muted",
        outline: "border border-solid border-line bg-white text-muted",
        destructive: "bg-[#fff0ef] text-[#a33a32]",
      },
    },
    defaultVariants: {
      variant: "muted",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

export function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && <span className="inline-block size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {children}
    </span>
  );
}
