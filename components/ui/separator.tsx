import * as React from "react";
import { cn } from "@/components/cn";

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      aria-orientation="horizontal"
      className={cn("m-0 h-px border-0 bg-line", className)}
      {...props}
    />
  );
}
