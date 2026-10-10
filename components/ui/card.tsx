import * as React from "react";
import { cn } from "@/components/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <article
      className={cn("rounded-xl border border-solid border-line bg-white p-5 shadow-card sm:p-6", className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("m-0 flex flex-col gap-1.5", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("m-0 font-display text-[17px] font-bold tracking-[-0.3px] text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("m-0 text-[12px] leading-relaxed text-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("m-0 mt-4 flex flex-col gap-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("m-0 mt-4 flex flex-wrap items-center justify-end gap-2", className)} {...props} />
  );
}
