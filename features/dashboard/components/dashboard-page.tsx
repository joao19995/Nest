"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateMonthlyPlan } from "@/features/monthly-plan/domain/calculate-monthly-plan";
import type { MonthlyPlan } from "@/features/monthly-plan/domain/types";
import { loadFinanceState } from "@/shared/lib/finance-storage";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function DashboardPage() {
  const [state, setState] = useState(initialFinanceState);
  useEffect(() => setState(loadFinanceState(initialFinanceState)), []);
  const year = 2026;
  const annualPlan = state.annualPlans.find((plan) => plan.year === year) ?? { year, allocations: [] };
  const months = monthNames.map((_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  const calculations = months.map((month) => calculateMonthlyPlan(state.configuration, annualPlan, state.months.find((item) => item.month === month) ?? ({ month, expenses: [] } satisfies MonthlyPlan)));
  const totalIncome = calculations.reduce((sum, calculation) => sum + calculation.totalIncome + calculation.totalBonus, 0);
  const totalExpenses = calculations.reduce((sum, calculation) => sum + calculation.plannedExpenses, 0);
  const totalAvailable = calculations.reduce((sum, calculation) => sum + calculation.availableForGoals, 0);
  const totalPlannedGoals = annualPlan.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const goalAllocation = (goalId: string, month: string) => annualPlan.allocations.find((allocation) => allocation.goalId === goalId && allocation.month === month)?.amount ?? 0;

  return <main className="shell"><AppNav active="dashboard" /><section className="hero-row"><div><p className="eyebrow">Visão anual</p><h1>Plano de {year}</h1><p className="lede">O que esperamos receber, gastar e direcionar para os Goals ao longo do ano.</p></div><Link className="new-month-button" href="/settings">Editar regras globais</Link></section><section className="metrics-grid"><article className="metric-card metric-primary"><div className="metric-label"><span className="dot green" /> Rendimentos esperados</div><strong><Money value={totalIncome} /></strong><span className="metric-note">salários + subsídios</span></article><article className="metric-card"><div className="metric-label"><span className="dot orange" /> Despesas esperadas</div><strong><Money value={totalExpenses} /></strong><span className="metric-note">planeamento mensal conhecido</span></article><article className="metric-card"><div className="metric-label"><span className="dot purple" /> Disponível para Goals</div><strong><Money value={totalAvailable} /></strong><span className="metric-note">depois das regras mensais</span></article><article className="metric-card"><div className="metric-label"><span className="dot blue" /> Goals planeados</div><strong><Money value={totalPlannedGoals} /></strong><span className="metric-note">decisões no plano anual</span></article></section><section className="annual-layout"><article className="panel annual-panel"><div className="panel-heading"><div><p className="eyebrow">Planeamento anual</p><h2>Distribuição esperada pelos meses</h2></div><Link className="text-button" href="/month">Abrir mês →</Link></div><div className="annual-table"><div className="annual-row annual-header"><span>Goal</span>{monthNames.map((month) => <span key={month}>{month}</span>)}<span>Total</span></div>{state.configuration.goals.map((goal) => { const total = months.reduce((sum, month) => sum + goalAllocation(goal.id, month), 0); return <div className="annual-row" key={goal.id}><strong>{goal.name}</strong>{months.map((month) => <span key={month}>{goalAllocation(goal.id, month) ? <Money value={goalAllocation(goal.id, month)} /> : "–"}</span>)}<strong><Money value={total} /></strong></div>; })}</div></article><aside className="dashboard-side"><article className="panel side-panel"><p className="eyebrow">Estado do plano</p><h2>{totalPlannedGoals < totalAvailable ? "Há dinheiro por planear" : "Plano anual preenchido"}</h2><p>{totalPlannedGoals < totalAvailable ? <><Money value={totalAvailable - totalPlannedGoals} /> ainda não têm um destino definido.</> : "As disponibilidades conhecidas estão cobertas pelo plano."}</p><Link className="text-button" href="/month">Ajustar plano mensal →</Link></article><article className="panel side-panel"><p className="eyebrow">Próximo passo</p><h2>Atualizar despesas reais</h2><p>No final do mês, compara o planeado com o que realmente aconteceu.</p><Link className="text-button" href="/month">Inserir despesas →</Link></article></aside></section></main>;
}
