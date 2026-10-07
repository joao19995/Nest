"use client";

import { useEffect, useState } from "react";
import { exampleMonth } from "@/features/monthly-plan/data/example-month";
import type { Goal, MonthlyPlan } from "@/features/monthly-plan/domain/types";
import { loadMonthlyPlan, resetMonthlyPlan, saveMonthlyPlan } from "@/shared/lib/finance-storage";
import { Money } from "@/shared/ui/money";

export function SettingsEditor() {
  const [plan, setPlan] = useState<MonthlyPlan>(exampleMonth);
  const [saved, setSaved] = useState(false);

  useEffect(() => setPlan(loadMonthlyPlan(exampleMonth)), []);

  function updatePerson(index: number, field: "income" | "fixedExpenses" | "dailyAmount" | "budget", value: number) {
    setPlan((current) => ({ ...current, people: current.people.map((person, personIndex) => personIndex === index ? { ...person, [field]: value } : person) }));
    setSaved(false);
  }

  function addIncomeRecord(index: number) {
    const person = plan.people[index];
    const validFrom = window.prompt("A partir de que mês?", "Novembro 2026");
    if (!validFrom) return;
    setPlan((current) => ({ ...current, people: current.people.map((item, personIndex) => personIndex === index ? { ...item, incomeHistory: [...item.incomeHistory, { amount: item.income, validFrom }] } : item) }));
    setSaved(false);
  }

  function updateGoal(index: number, changes: Partial<Goal>) {
    setPlan((current) => ({ ...current, goals: current.goals.map((goal, goalIndex) => goalIndex === index ? { ...goal, ...changes } : goal) }));
    setSaved(false);
  }

  function save() {
    saveMonthlyPlan(plan);
    setSaved(true);
  }

  function reset() {
    resetMonthlyPlan();
    setPlan(exampleMonth);
    setSaved(false);
  }

  return <>
    <div className="editor-actions"><button className="secondary-button" type="button" onClick={reset}>Repor exemplos</button><button className="save-button" type="button" onClick={save}>{saved ? "Guardado" : "Guardar configurações"}</button></div>
    <section className="settings-section"><div className="section-title"><div><p className="eyebrow">Base mensal</p><h2>Pessoas e rendimentos</h2></div><span className="settings-status">Histórico ativo</span></div><div className="editable-people">{plan.people.map((person, index) => <div className="editable-person" key={person.name}><div className="person-name"><strong>{person.name}</strong><small>Último registo: {person.incomeHistory[person.incomeHistory.length - 1].validFrom}</small><button className="inline-button" type="button" onClick={() => addIncomeRecord(index)}>+ Adicionar alteração</button></div><label>Rendimento atual<input type="number" value={person.income} onChange={(event) => updatePerson(index, "income", Number(event.target.value))} /></label><label>Gastos fixos<input type="number" value={person.fixedExpenses} onChange={(event) => updatePerson(index, "fixedExpenses", Number(event.target.value))} /></label><label>Dia a dia<input type="number" value={person.dailyAmount} onChange={(event) => updatePerson(index, "dailyAmount", Number(event.target.value))} /></label><label>Budget mensal<input type="number" value={person.budget} onChange={(event) => updatePerson(index, "budget", Number(event.target.value))} /></label></div>)}</div></section>
    <section className="settings-section"><div className="section-title"><div><p className="eyebrow">Objetivos anuais</p><h2>Goals e prioridades</h2></div><span className="settings-status">Ano 2026</span></div><div className="editable-goals">{plan.goals.map((goal, index) => <div className="editable-goal" key={goal.name}><div><strong>{goal.name}</strong><small>{goal.notes}</small></div><label>Valor-alvo<input type="number" value={goal.target} onChange={(event) => updateGoal(index, { target: Number(event.target.value) })} /></label><label>Período<select value={goal.period} onChange={(event) => updateGoal(index, { period: event.target.value })}><option>Anual</option><option>T1</option><option>T2</option><option>T3</option><option>T4</option></select></label><label>Prioridade<select value={goal.priority} onChange={(event) => updateGoal(index, { priority: event.target.value as Goal["priority"] })}><option>Grande</option><option>Nice to have</option></select></label><span className="goal-annual-value"><Money value={goal.target} /></span></div>)}</div></section>
  </>;
}
