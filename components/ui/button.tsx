import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/components/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-55",
  {
    variants: {
      variant: {
        primary: "border border-solid border-ink bg-ink text-white hover:bg-ink-soft hover:border-ink-soft",
        secondary: "border border-solid border-line bg-white text-ink-soft hover:border-primary hover:text-primary-dark",
        ghost: "border border-solid border-transparent bg-transparent text-muted hover:text-ink hover:bg-mint-soft",
      },
      size: {
        default: "min-h-10 px-3.5",
        sm: "min-h-9 px-3",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
