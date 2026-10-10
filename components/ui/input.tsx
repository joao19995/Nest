import * as React from "react";
import { cn } from "@/components/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type = "text", ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "w-full min-h-[38px] rounded-lg border border-solid border-line bg-input-bg px-2.5",
        "text-[13px] font-semibold text-ink tabular-nums placeholder:text-faint",
        "hover:border-[#cfd8d2] focus:border-primary focus:bg-white focus:outline-none",
        "focus:shadow-[0_0_0_3px_rgb(46_139_103/25%)]",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-line-soft",
        className,
      )}
      {...props}
    />
  );
}
