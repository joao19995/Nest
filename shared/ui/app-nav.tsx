"use client";

import Link from "next/link";

export function AppNav({ active }: { active: "dashboard" | "month" | "people" | "categories" | "settings" }) {
  return <header className="topbar"><Link className="brand" href="/"><span className="brand-mark">+</span><span>nosso<span className="brand-accent">plano</span></span></Link><nav><Link className={`nav-link ${active === "dashboard" ? "active" : ""}`} href="/">Dashboard</Link><Link className={`nav-link ${active === "month" ? "active" : ""}`} href="/month">Mês</Link><Link className={`nav-link ${active === "people" ? "active" : ""}`} href="/people">Pessoas e contas</Link><Link className={`nav-link ${active === "categories" ? "active" : ""}`} href="/categories">Categorias</Link></nav><div className="profile"><span className="avatar">J</span><span>João & Natch</span></div></header>;
}
