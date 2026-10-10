"use client";

import { useEffect, useMemo, useState } from "react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { Category, MonthlyPlanView } from "@/features/monthly-plan/domain/types";
import { buildDashboardRows } from "../domain/dashboard-table";

function monthLabel(month: string) {
  return new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function percent(value: number | null) {
  if (value === null) return "—";
  return `${value.toLocaleString("pt-PT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

export function DashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [categories, setCategories] = useState<Category[]>([]);
  const [plans, setPlans] = useState<MonthlyPlanView[]>([]);
  // null = ainda não escolhido pelo utilizador: mostra todas as categorias.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([entitiesClient.getCategories(), entitiesClient.getMonthlyPlansByYear(year)]).then(([loadedCategories, loadedPlans]) => {
      if (!active) return;
      setCategories(loadedCategories);
      setPlans(loadedPlans);
      setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o dashboard.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [year]);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.name.localeCompare(b.name)), [categories]);
  const chosenIds = (picked ?? sortedCategories.map((category) => category.id)).filter((id) => sortedCategories.some((category) => category.id === id));
  const chosenCategories = sortedCategories.filter((category) => chosenIds.includes(category.id));
  const rows = useMemo(() => buildDashboardRows(year, plans, chosenIds), [year, plans, chosenIds.join("|")]);

  function toggleCategory(id: string) {
    setPicked((current) => {
      const base = current ?? sortedCategories.map((category) => category.id);
      return base.includes(id) ? base.filter((category) => category !== id) : [...base, id];
    });
  }

  const gridColumns = `120px repeat(${Math.max(chosenCategories.length, 1)}, minmax(90px, 1fr)) 110px 110px 110px 90px`;

  return (
    <main className="shell">
      <AppNav active="dashboard" />
      <div className="page-heading">
        <p className="eyebrow">Dashboard</p>
        <h1>Valores actuais por mês</h1>
        <p className="lede">Escolhe as categorias a mostrar. Desvio = actual − planeado do mês inteiro (todas as categorias). Meses sem plano aparecem vazios.</p>
      </div>

      <div className="month-controls">
        <button className="month-arrow" onClick={() => setYear((current) => current - 1)} aria-label="Ano anterior">‹</button>
        <span className="month-current">{year}</span>
        <button className="month-arrow" onClick={() => setYear((current) => current + 1)} aria-label="Ano seguinte">›</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="form-note">A carregar…</p>}

      {!loading && !error && <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Categorias</p><h2>Categorias mostradas</h2></div></div>
        {!sortedCategories.length && <p className="form-note">Ainda não há categorias. Cria-as na página Categorias.</p>}
        <div className="entity-action-buttons" style={{ flexWrap: "wrap" }}>
          {sortedCategories.map((category) => <label key={category.id} className="goal-chip">
            <input type="checkbox" checked={chosenIds.includes(category.id)} onChange={() => toggleCategory(category.id)} />
            {category.name}{category.active ? "" : " (inativa)"}
          </label>)}
        </div>
      </section>}

      {!loading && !error && sortedCategories.length > 0 && <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">{year}</p><h2>Meses × categorias</h2></div></div>
        {!chosenCategories.length && <p className="form-note">Escolhe pelo menos uma categoria para ver a tabela.</p>}
        {chosenCategories.length > 0 && <div className="annual-table">
          <div className="category-table-row category-table-header" style={{ gridTemplateColumns: gridColumns, minWidth: 0 }}>
            <span>Mês</span>
            {chosenCategories.map((category) => <span key={category.id}>{category.name}</span>)}
            <span>Planeado</span>
            <span>Actual</span>
            <span>Desvio €</span>
            <span>Desvio %</span>
          </div>
          {rows.map((row) => <div className="category-table-row" key={row.month} style={{ gridTemplateColumns: gridColumns, minWidth: 0 }}>
            <strong>{monthLabel(row.month)}{!row.hasPlan && <small>Sem plano</small>}</strong>
            {chosenCategories.map((category) => <span key={category.id}>{row.actualByCategory[category.id] === null || row.actualByCategory[category.id] === undefined ? "" : <Money value={row.actualByCategory[category.id]!} />}</span>)}
            <span>{row.plannedTotal === null ? "" : <Money value={row.plannedTotal} />}</span>
            <span>{row.actualTotal === null ? "" : <Money value={row.actualTotal} />}</span>
            <span>{row.deviation === null ? "" : <Money value={row.deviation} />}</span>
            <span>{percent(row.deviationPct)}</span>
          </div>)}
        </div>}
      </section>}
    </main>
  );
}
