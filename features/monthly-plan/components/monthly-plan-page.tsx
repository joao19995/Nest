"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateMonthlyPlan } from "../domain/calculate-monthly-plan";
import { exampleConfiguration, exampleMonth } from "../data/example-month";
import type { FinanceState } from "../domain/types";
import { loadFinanceState, saveFinanceState } from "@/shared/lib/finance-storage";
import { Money } from "@/shared/ui/money";

const initialState: FinanceState = { configuration: exampleConfiguration, months: [exampleMonth] };

function displayMonth(month: string) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date(`${month}-01`));
}

export function MonthlyPlanPage() {
  const [state, setState] = useState(initialState);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saved, setSaved] = useState(false);
  useEffect(() => setState(loadFinanceState(initialState)), []);

  const month = state.months[selectedIndex] ?? state.months[0];
  const calculation = calculateMonthlyPlan(state.configuration, month);
  const categoryName = (id: string) => state.configuration.categories.find((category) => category.id === id)?.name ?? id;
  const personName = (id: string) => state.configuration.people.find((person) => person.id === id)?.name ?? id;

  function updateExpense(index: number, field: "planned" | "actual", value: number) {
    setState((current) => ({ ...current, months: current.months.map((item, monthIndex) => monthIndex === selectedIndex ? { ...item, expenses: item.expenses.map((expense, expenseIndex) => expenseIndex === index ? { ...expense, [field]: value } : expense) } : item) }));
    setSaved(false);
  }

  function createNextMonth() {
    const nextDate = new Date(`${month.month}-01`);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
    setState((current) => ({ ...current, months: [...current.months, { month: nextMonth, expenses: month.expenses.map((expense) => ({ ...expense, actual: 0 })) }] }));
    setSelectedIndex(state.months.length);
    setSaved(false);
  }

  function save() {
    saveFinanceState(state);
    setSaved(true);
  }

  return <main className="shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">+</span><span>nosso<span className="brand-accent">plano</span></span></div><nav><Link className="nav-link active" href="/">Plano mensal</Link><Link className="nav-link" href="/settings">Configurações</Link></nav><div className="profile"><span className="avatar">J</span><span>João & Natch</span></div></header>
    <section className="hero-row"><div><p className="eyebrow">O teu plano</p><h1>{displayMonth(month.month)}</h1><p className="lede">Planeamento e despesas reais do mês, separados das regras de configuração.</p></div><div className="month-controls"><button className="month-arrow" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((index) => index - 1)}>‹</button><span className="month-current">{displayMonth(month.month)}</span><button className="month-arrow" disabled={selectedIndex === state.months.length - 1} onClick={() => setSelectedIndex((index) => index + 1)}>›</button><button className="new-month-button" onClick={createNextMonth}>+ Novo mês</button></div></section>
    <section className="metrics-grid"><article className="metric-card metric-primary"><div className="metric-label"><span className="dot green" /> Rendimentos</div><strong><Money value={calculation.totalIncome} /></strong><span className="metric-note">valor aplicável ao mês</span></article><article className="metric-card"><div className="metric-label"><span className="dot orange" /> Despesas reais</div><strong><Money value={calculation.actualExpenses} /></strong><span className="metric-note">de <Money value={calculation.plannedExpenses} /> planeadas</span></article><article className="metric-card"><div className="metric-label"><span className="dot purple" /> Sobra para Goals</div><strong><Money value={calculation.availableForGoals} /></strong><span className="metric-note">após regras de planeamento</span></article><article className="metric-card"><div className="metric-label"><span className="dot blue" /> Transferências</div><strong><Money value={calculation.transfers.reduce((sum, transfer) => sum + transfer.amount, 0)} /></strong><span className="metric-note">calculadas automaticamente</span></article></section>
    <section className="content-grid"><article className="panel expenses-panel"><div className="panel-heading"><div><p className="eyebrow">Actual mensal</p><h2>Despesas por categoria e conta</h2></div><span className="panel-total"><Money value={calculation.actualExpenses} /></span></div><div className="expense-list">{month.expenses.map((expense, index) => <div className="expense-row editable-expense" key={`${expense.categoryId}-${expense.accountId}`}><span className="category-dot" /><span className="expense-name">{categoryName(expense.categoryId)}<small>{state.configuration.accounts.find((account) => account.id === expense.accountId)?.name}</small></span><label>planeado<input type="number" value={expense.planned} onChange={(event) => updateExpense(index, "planned", Number(event.target.value))} /></label><label>real<input type="number" value={expense.actual} onChange={(event) => updateExpense(index, "actual", Number(event.target.value))} /></label></div>)}</div><p className="form-note">Os valores reais são introduzidos manualmente no fecho do mês.</p></article><article className="panel goals-panel"><div className="panel-heading"><div><p className="eyebrow">Objetivos anuais</p><h2>Goals</h2></div><span className="panel-total">resultado disponível</span></div><div className="goal-list">{state.configuration.goals.slice(0, 4).map((goal) => <div className="goal-row" key={goal.id}><div className="goal-topline"><span>{goal.name}</span><strong><Money value={goal.target} /></strong></div><div className="goal-meta"><span>{goal.period} · {goal.priority}</span><span>alocação por definir</span></div></div>)}</div><Link className="text-button" href="/settings">Gerir Goals <span>→</span></Link></article></section>
    <section className="transfer-panel panel"><div className="panel-heading"><div><p className="eyebrow">Resultado calculado</p><h2>Transferências para a conta conjunta</h2></div><span className="panel-total">sem input manual</span></div><div className="transfer-list">{calculation.transfers.map((transfer) => <div className="transfer-row" key={transfer.personId}><span className="transfer-person">{personName(transfer.personId)}<small>mínimo ou despesas conjuntas</small></span><strong><Money value={transfer.amount} /></strong></div>)}</div></section>
    <section className="bottom-grid"><article className="insight-card"><div className="insight-symbol">✦</div><div><p className="eyebrow">Regra aplicada</p><h3>Dia a dia: {state.configuration.dailySpendingPercentage}% do rendimento.</h3><p>Este valor é calculado automaticamente para cada mês.</p></div></article><article className="emergency-card"><div><p className="eyebrow">Fundo de emergência</p><h3><Money value={calculation.emergencyFund} /></h3><p>Gastos fixos globais: <Money value={state.configuration.fixedExpenses} />.</p></div><span className="ring">6<span>meses</span></span></article></section>
    <div className="monthly-actions"><span>{saved ? "Alterações guardadas neste dispositivo." : "Guarda as alterações depois de fechar o mês."}</span><button className="save-button" onClick={save}>{saved ? "Guardado" : "Guardar mês"}</button></div>
  </main>;
}
