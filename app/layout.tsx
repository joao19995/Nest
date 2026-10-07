import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanças | Plano mensal",
  description: "Planeamento financeiro mensal simples para duas pessoas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT">
      <body>{children}</body>
    </html>
  );
}
