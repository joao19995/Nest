"use client";

import { useEffect, useState } from "react";
import { exampleConfiguration, exampleMonth } from "@/features/monthly-plan/data/example-month";
import type { FinanceState } from "@/features/monthly-plan/domain/types";
import { loadFinanceState, resetFinanceState, saveFinanceState } from "@/shared/lib/finance-storage";
import { Money } from "@/shared/ui/money";

const initialState: FinanceState = { configuration: exampleConfiguration, months: [exampleMonth] };

export function SettingsEditor() {
  const [state, setState] = useState(initialState);
  const [saved, setSaved] = useState(false);
  useEffect(() => setState(loadFinanceState(initialState)), []);
  const configuration = state.configuration;

  function updateConfiguration(changes: Partial<typeof configuration>) {
    setState((current) => ({ ...current, configuration: { ...current.configuration, ...changes } }));
    setSaved(false);
  }

  function updateIncome(personId: string, amount: number) {
    updateConfiguration({ incomes: configuration.incomes.map((income) => income.personId === personId ? { ...income, periods: income.periods.map((period, index) => index === income.periods.length - 1 ? { ...period, amount } : period) } : income) });
  }

  function updateContribution(personId: string, minimumAmount: number) {
    updateConfiguration({ contributionRules: configuration.contributionRules.map((rule) => rule.personId === personId ? { ...rule, minimumAmount } : rule) });
  }

  function updateGoal(index: number, target: number) {
    updateConfiguration({ goals: configuration.goals.map((goal, goalIndex) => goalIndex === index ? { ...goal, target } : goal) });
  }

  function save() { saveFinanceState(state); setSaved(true); }
  function reset() { resetFinanceState(); setState(initialState); setSaved(false); }

  return <><div className="editor-actions"><button className="secondary-button" onClick={reset}>Repor exemplos</button><button className="save-button" onClick={save}>{saved ? "Guardado" : "Guardar configurações"}</button></div><section className="settings-section"><div className="section-title"><div><p className="eyebrow">Configuração</p><h2>Regras globais</h2></div><span className="settings-status">Aplicadas a cada mês</span></div><div className="global-settings"><label>Gastos fixos globais<input type="number" value={configuration.fixedExpenses} onChange={(event) => updateConfiguration({ fixedExpenses: Number(event.target.value) })} /></label><label>Dia a dia (% do rendimento)<input type="number" value={configuration.dailySpendingPercentage} onChange={(event) => updateConfiguration({ dailySpendingPercentage: Number(event.target.value) })} /></label><div className="calculated-setting"><small>Fundo de emergência</small><strong><Money value={configuration.fixedExpenses * 1.1 * 6} /></strong><span>gastos fixos × 110% × 6</span></div></div></section><section className="settings-section"><div className="section-title"><div><p className="eyebrow">Pessoas</p><h2>Rendimentos e contribuições</h2></div><span className="settings-status">Histórico por período</span></div><div className="editable-people">{configuration.people.map((person) => { const income = configuration.incomes.find((item) => item.personId === person.id)!; const currentPeriod = income.periods[income.periods.length - 1]; const rule = configuration.contributionRules.find((item) => item.personId === person.id); return <div className="editable-person" key={person.id}><div className="person-name"><strong>{person.name}</strong><small>Último registo: {currentPeriod.validFrom}</small></div><label>Rendimento atual<input type="number" value={currentPeriod.amount} onChange={(event) => updateIncome(person.id, Number(event.target.value))} /></label><label>Contribuição mínima<input type="number" value={rule?.minimumAmount ?? 0} onChange={(event) => updateContribution(person.id, Number(event.target.value))} /></label><div className="history-summary"><small>Histórico</small>{income.periods.map((period) => <span key={period.validFrom}>{period.validFrom}: <Money value={period.amount} /></span>)}</div></div>; })}</div></section><section className="settings-section"><div className="section-title"><div><p className="eyebrow">Objetivos anuais</p><h2>Goals</h2></div><span className="settings-status">{configuration.goals.length} configurados</span></div><div className="editable-goals">{configuration.goals.map((goal, index) => <div className="editable-goal" key={goal.id}><div><strong>{goal.name}</strong><small>{goal.period} · {goal.priority}</small></div><label>Valor-alvo<input type="number" value={goal.target} onChange={(event) => updateGoal(index, Number(event.target.value))} /></label><span className="goal-annual-value"><Money value={goal.target} /></span></div>)}</div></section></>;
}
