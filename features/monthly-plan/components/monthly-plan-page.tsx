"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateMonthlySummary } from "../domain/calculate-monthly-plan";
import { exampleMonth } from "../data/example-month";
import { Money } from "@/shared/ui/money";
import { loadMonthlyPlans, saveMonthlyPlans } from "@/shared/lib/finance-storage";

export function MonthlyPlanPage() {
  const [plans, setPlans] = useState([exampleMonth]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => setPlans(loadMonthlyPlans([exampleMonth])), []);

  const plan = plans[selectedIndex] ?? plans[0] ?? exampleMonth;
  const summary = calculateMonthlySummary(plan);
  const totalGoalAllocation = plan.goals.reduce((total, goal) => total + goal.allocated, 0);

  function changePlan(update: (current: typeof plan) => typeof plan) {
    setPlans((current) => current.map((item, index) => index === selectedIndex ? update(item) : item));
    setSaved(false);
  }

  function updateExpense(index: number, field: "planned" | "actual", value: number) {
    changePlan((current) => ({ ...current, expenses: current.expenses.map((expense, expenseIndex) => expenseIndex === index ? { ...expense, [field]: value } : expense) }));
  }

  function removeExpense(index: number) {
    changePlan((current) => ({ ...current, expenses: current.expenses.filter((_, expenseIndex) => expenseIndex !== index) }));
  }

  function addExpense() {
    const category = window.prompt("Nome da categoria");
    if (!category) return;
    changePlan((current) => ({ ...current, expenses: [...current.expenses, { category, planned: 0, actual: 0 }] }));
  }

  function updateTransfer(index: number, amount: number) {
    changePlan((current) => ({ ...current, transfers: current.transfers.map((transfer, transferIndex) => transferIndex === index ? { ...transfer, amount } : transfer) }));
  }

  function save() {
    saveMonthlyPlans(plans);
    setSaved(true);
  }

  function createNextMonth() {
    const currentDate = new Date(2026, 9 + selectedIndex, 1);
    const monthName = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(currentDate);
    const newPlan = { ...plan, month: monthName.charAt(0).toUpperCase() + monthName.slice(1), expenses: plan.expenses.map((expense) => ({ ...expense, actual: 0 })), transfers: plan.transfers.map((transfer) => ({ ...transfer })), goals: plan.goals.map((goal) => ({ ...goal, allocated: 0 })) };
    setPlans((current) => [...current, newPlan]);
    setSelectedIndex(plans.length);
    setSaved(false);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">+</span><span>nosso<span className="brand-accent">plano</span></span></div>
        <nav><Link className="nav-link active" href="/">Plano mensal</Link><Link className="nav-link" href="/settings">Configurações</Link></nav>
        <div className="profile"><span className="avatar">J</span><span>João & Natch</span><span className="chevron">⌄</span></div>
      </header>

      <section className="hero-row">
        <div><p className="eyebrow">O teu plano</p><h1>{plan.month}</h1><p className="lede">Uma visão simples do que entra, sai e fica disponível este mês.</p></div>
        <div className="month-controls"><button className="month-arrow" type="button" disabled={selectedIndex === 0} onClick={() => setSelectedIndex((index) => index - 1)}>‹</button><span className="month-current">{plan.month}</span><button className="month-arrow" type="button" disabled={selectedIndex === plans.length - 1} onClick={() => setSelectedIndex((index) => index + 1)}>›</button><button className="new-month-button" type="button" onClick={createNextMonth}>+ Novo mês</button></div>
      </section>

      <section className="metrics-grid" aria-label="Resumo do mês">
        <article className="metric-card metric-primary"><div className="metric-label"><span className="dot green" /> Rendimentos</div><strong><Money value={summary.income} /></strong><span className="metric-note">João + Natch</span></article>
        <article className="metric-card"><div className="metric-label"><span className="dot orange" /> Despesas reais</div><strong><Money value={summary.actualExpenses} /></strong><span className="metric-note">de <Money value={summary.plannedExpenses} /> planeadas</span></article>
        <article className="metric-card"><div className="metric-label"><span className="dot purple" /> Sobra para Goals</div><strong><Money value={summary.surplus} /></strong><span className="metric-note">após gastos fixos e dia a dia</span></article>
        <article className="metric-card"><div className="metric-label"><span className="dot blue" /> Transferências</div><strong><Money value={summary.transfers} /></strong><span className="metric-note">para a conta conjunta</span></article>
      </section>

      <section className="content-grid">
        <article className="panel expenses-panel"><div className="panel-heading"><div><p className="eyebrow">Acompanhar</p><h2>Despesas do mês</h2></div><span className="panel-total"><Money value={summary.actualExpenses} /></span></div><div className="expense-list">{plan.expenses.map((expense, index) => <div className="expense-row editable-expense" key={expense.category}><span className="category-dot" /><span className="expense-name">{expense.category}</span><label>planeado<input type="number" value={expense.planned} onChange={(event) => updateExpense(index, "planned", Number(event.target.value))} /></label><label>real<input type="number" value={expense.actual} onChange={(event) => updateExpense(index, "actual", Number(event.target.value))} /></label><button className="remove-button" type="button" aria-label={`Remover ${expense.category}`} onClick={() => removeExpense(index)}>×</button></div>)}</div><button className="text-button" type="button" onClick={addExpense}>+ Adicionar categoria</button></article>
        <article className="panel goals-panel"><div className="panel-heading"><div><p className="eyebrow">Progresso</p><h2>Os teus Goals</h2></div><span className="panel-total"><Money value={totalGoalAllocation} /> este mês</span></div><div className="goal-list">{plan.goals.slice(0, 4).map((goal) => <div className="goal-row" key={goal.name}><div className="goal-topline"><span><span className={`goal-icon ${goal.color}`}>↗</span>{goal.name}</span><strong><Money value={goal.allocated} /></strong></div><div className="progress-track"><span className={`progress-fill ${goal.color}`} style={{ width: `${goal.target ? Math.min((goal.allocated / goal.target) * 100 * 8, 100) : 0}%` }} /></div><div className="goal-meta"><span>{goal.period} · {goal.priority}</span><span>meta <Money value={goal.target} /></span></div></div>)}</div><Link className="text-button" href="/settings">Gerir Goals <span>→</span></Link></article>
      </section>

      <section className="transfer-panel panel"><div className="panel-heading"><div><p className="eyebrow">Fecho mensal</p><h2>Transferências para a conta conjunta</h2></div><span className="panel-total"><Money value={summary.transfers} /></span></div><div className="transfer-list">{plan.transfers.map((transfer, index) => <div className="transfer-row" key={transfer.person}><span className="transfer-person">{transfer.person}<small>{transfer.account}</small></span><label>valor a transferir<input type="number" value={transfer.amount} onChange={(event) => updateTransfer(index, Number(event.target.value))} /></label></div>)}</div></section><section className="bottom-grid"><article className="insight-card"><div className="insight-symbol">✦</div><div><p className="eyebrow">Nota do mês</p><h3>Estão a faltar <Money value={summary.surplus - totalGoalAllocation} /> para distribuir.</h3><p>A sobra calculada depois dos gastos fixos e do dia a dia ainda não está totalmente alocada.</p></div></article><article className="emergency-card"><div><p className="eyebrow">Fundo de emergência</p><h3>Individual</h3><p>João <Money value={summary.emergencyFundByPerson[0].amount} /> · Natch <Money value={summary.emergencyFundByPerson[1].amount} /></p></div><span className="ring">6<span>meses</span></span></article></section><div className="monthly-actions"><span>{saved ? "Alterações guardadas neste dispositivo." : "Altera os valores e guarda o mês quando terminares."}</span><button className="save-button" type="button" onClick={save}>{saved ? "Guardado" : "Guardar mês"}</button></div>
    </main>
  );
}
