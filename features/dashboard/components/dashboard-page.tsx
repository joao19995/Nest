"use client";

import { useEffect, useMemo, useState } from "react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { MonthlyPlanView } from "@/features/monthly-plan/domain/types";
import type { ItemView } from "@/shared/repositories/item-repository";
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
  const [items, setItems] = useState<ItemView[]>([]);
  const [plans, setPlans] = useState<MonthlyPlanView[]>([]);
  // null = ainda não escolhido pelo utilizador: mostra todos os itens.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.all([entitiesClient.getItems(), entitiesClient.getMonthlyPlansByYear(year)]).then(([loadedItems, loadedPlans]) => {
      if (!active) return;
      setItems(loadedItems);
      setPlans(loadedPlans);
      setLoading(false);
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o dashboard.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [year]);

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.categoryName.localeCompare(b.categoryName) || a.name.localeCompare(b.name)), [items]);
  const chosenIds = (picked ?? sortedItems.map((item) => item.id)).filter((id) => sortedItems.some((item) => item.id === id));
  const chosenItems = sortedItems.filter((item) => chosenIds.includes(item.id));
  const rows = useMemo(() => buildDashboardRows(year, plans, chosenIds), [year, plans, chosenIds.join("|")]);

  function toggleItem(id: string) {
    setPicked((current) => {
      const base = current ?? sortedItems.map((item) => item.id);
      return base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
    });
  }

  const gridColumns = `120px repeat(${Math.max(chosenItems.length, 1)}, minmax(90px, 1fr)) 110px 110px 110px 90px`;

  return (
    <main className="shell">
      <AppNav active="dashboard" />
      <div className="page-heading">
        <p className="eyebrow">Dashboard</p>
        <h1>Valores actuais por mês</h1>
        <p className="lede">Escolhe os itens a mostrar. Desvio = actual − planeado do mês inteiro (todos os itens). Meses sem plano aparecem vazios.</p>
      </div>

      <div className="month-controls">
        <button className="month-arrow" onClick={() => setYear((current) => current - 1)} aria-label="Ano anterior">‹</button>
        <span className="month-current">{year}</span>
        <button className="month-arrow" onClick={() => setYear((current) => current + 1)} aria-label="Ano seguinte">›</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="form-note">A carregar…</p>}

      {!loading && !error && <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Itens</p><h2>Itens mostrados</h2></div></div>
        {!sortedItems.length && <p className="form-note">Ainda não há itens. Cria-os na página Categorias.</p>}
        <div className="entity-action-buttons" style={{ flexWrap: "wrap" }}>
          {sortedItems.map((item) => <label key={item.id} className="goal-chip">
            <input type="checkbox" checked={chosenIds.includes(item.id)} onChange={() => toggleItem(item.id)} />
            {item.name} <small>· {item.categoryName}{item.active ? "" : " (inativo)"}</small>
          </label>)}
        </div>
      </section>}

      {!loading && !error && sortedItems.length > 0 && <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">{year}</p><h2>Meses × itens</h2></div></div>
        {!chosenItems.length && <p className="form-note">Escolhe pelo menos um item para ver a tabela.</p>}
        {chosenItems.length > 0 && <div className="annual-table">
          <div className="category-table-row category-table-header" style={{ gridTemplateColumns: gridColumns, minWidth: 0 }}>
            <span>Mês</span>
            {chosenItems.map((item) => <span key={item.id}>{item.name}</span>)}
            <span>Planeado</span>
            <span>Actual</span>
            <span>Desvio €</span>
            <span>Desvio %</span>
          </div>
          {rows.map((row) => <div className="category-table-row" key={row.month} style={{ gridTemplateColumns: gridColumns, minWidth: 0 }}>
            <strong>{monthLabel(row.month)}{!row.hasPlan && <small>Sem plano</small>}</strong>
            {chosenItems.map((item) => <span key={item.id}>{row.actualByItem[item.id] === null || row.actualByItem[item.id] === undefined ? "" : <Money value={row.actualByItem[item.id]!} />}</span>)}
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
