"use client";

import Link from "next/link";

export function AppNav({ active }: { active: "dashboard" | "month" | "goals" | "people" | "categories" }) {
  const link = (key: typeof active, href: string, label: string) => (
    <Link className={`nav-link ${active === key ? "active" : ""}`} href={href} aria-current={active === key ? "page" : undefined}>{label}</Link>
  );
  return <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">+</span><span>nosso<span className="brand-accent">plano</span></span></Link><nav aria-label="Navegação principal">{link("dashboard", "/", "Dashboard")}{link("month", "/month", "Mês")}{link("goals", "/goals", "Objetivos")}{link("people", "/people", "Pessoas e contas")}{link("categories", "/categories", "Categorias")}</nav><div className="profile"><span className="avatar">J</span><span>João & Natch</span></div></header>;
}
