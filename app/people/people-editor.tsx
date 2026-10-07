"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateMonthlyPlan } from "@/features/monthly-plan/domain/calculate-monthly-plan";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { loadFinanceState, saveFinanceState } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { FinanceState } from "@/features/monthly-plan/domain/types";

type SalaryDraft = { amount: number; validFrom: string };

export function PeopleEditor() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [drafts, setDrafts] = useState<Record<string, SalaryDraft>>({});
  const [emergencyMonths, setEmergencyMonths] = useState(initialFinanceState.configuration.emergencyFundMonths);
  const [dailyPercentage, setDailyPercentage] = useState(initialFinanceState.configuration.dailySpendingPercentage);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const loaded = loadFinanceState(initialFinanceState);
    setState(loaded);
    setEmergencyMonths(loaded.configuration.emergencyFundMonths);
    setDailyPercentage(loaded.configuration.dailySpendingPercentage);
    setDrafts(Object.fromEntries(loaded.configuration.incomes.map((income) => { const latest = income.periods[income.periods.length - 1]; return [income.personId, { amount: latest.amount, validFrom: latest.validFrom }]; })));
  }, []);

  const referenceMonth = state.months[0] ?? { month: "2026-10", expenses: [] };
  const annualPlan = state.annualPlans.find((plan) => plan.year === Number(referenceMonth.month.slice(0, 4))) ?? { year: Number(referenceMonth.month.slice(0, 4)), allocations: [] };
  const calculation = calculateMonthlyPlan(state.configuration, annualPlan, referenceMonth);
  const totalIncome = state.configuration.people.reduce((sum, person) => sum + (drafts[person.id]?.amount ?? 0), 0);
  const totalExcess = state.configuration.people.reduce((sum, person) => sum + (drafts[person.id]?.amount ?? 0) * dailyPercentage / 100, 0);
  const totalSubsidies = state.configuration.incomes.reduce((sum, income) => sum + (drafts[income.personId]?.amount ?? 0) * income.bonusMonths.length, 0);
  const totalContributions = calculation.transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  const totalEmergency = calculation.emergencyFund;

  function updateDraft(personId: string, field: keyof SalaryDraft, value: string) { setDrafts((current) => ({ ...current, [personId]: { ...current[personId], [field]: field === "amount" ? Number(value) : value } })); setSaved(false); }
  function save() { const incomes = state.configuration.incomes.map((income) => { const draft = drafts[income.personId]; if (!draft) return income; const periods = [...income.periods.filter((period) => period.validFrom !== draft.validFrom), { amount: draft.amount, validFrom: draft.validFrom }].sort((a, b) => a.validFrom.localeCompare(b.validFrom)); return { ...income, periods }; }); const nextState = { ...state, configuration: { ...state.configuration, incomes, emergencyFundMonths: emergencyMonths, dailySpendingPercentage: dailyPercentage } }; setState(nextState); saveFinanceState(nextState); setSaved(true); }

  return <main className="shell compact-shell"><AppNav active="people" /><div className="page-heading"><Link className="back-link" href="/">← Dashboard</Link><p className="eyebrow">Vencimentos</p><h1>Valores mensais</h1><p className="lede">Valores mensais de referência. O histórico de salários é usado nos cálculos dos meses futuros.</p><div className="people-rules"><label className="emergency-month-setting">Meses do fundo de emergência<input type="number" value={emergencyMonths} onChange={(event) => { setEmergencyMonths(Number(event.target.value)); setSaved(false); }} /></label><label className="emergency-month-setting">Gastos do dia a dia (%)<input type="number" value={dailyPercentage} onChange={(event) => { setDailyPercentage(Number(event.target.value)); setSaved(false); }} /></label></div></div><div className="editor-actions"><button className="save-button" onClick={save}>{saved ? "Guardado" : "Guardar alterações"}</button></div><section className="settings-section"><div className="section-title"><div><p className="eyebrow">Valores mensais</p><h2>Salário e regras calculadas</h2></div><span className="settings-status">Contribuição não editável</span></div><div className="salary-table"><div className="salary-row salary-header"><span>Pessoa</span><span>Vencimento mensal</span><span>Subsídios</span><span>Excedente individual</span><span>Contribuição</span><span>Fundo emergência</span></div>{state.configuration.people.map((person) => { const income = state.configuration.incomes.find((item) => item.personId === person.id)!; const latest = income.periods[income.periods.length - 1]; const draft = drafts[person.id] ?? { amount: latest.amount, validFrom: latest.validFrom }; const dailySurplus = draft.amount * dailyPercentage / 100; const transfer = calculation.transfers.find((item) => item.personId === person.id); const share = totalIncome > 0 ? draft.amount / totalIncome : 0; const emergencyValue = totalEmergency * share; const subsidyTotal = draft.amount * income.bonusMonths.length; return <div className="salary-row salary-row-wide" key={person.id}><strong>{person.name}<small>Histórico: {income.periods.length} registos</small></strong><span><input className="salary-input" type="number" value={draft.amount} onChange={(event) => updateDraft(person.id, "amount", event.target.value)} /><small>atual desde <input className="date-input" type="month" value={draft.validFrom} onChange={(event) => updateDraft(person.id, "validFrom", event.target.value)} /></small></span><span><Money value={subsidyTotal} /><small>2 meses: Junho e Dezembro</small></span><span><Money value={dailySurplus} /><small>{dailyPercentage}% do vencimento</small></span><span><Money value={transfer?.amount ?? 0} /><small>calculada automaticamente</small></span><span><Money value={emergencyValue} /><small>{emergencyMonths} meses proporcionais</small></span></div>; })}</div></section><section className="salary-summary"><article className="panel"><p className="eyebrow">Subsídios do casal</p><h2><Money value={totalSubsidies} /></h2><p>Total de Junho e Dezembro.</p></article><article className="panel"><p className="eyebrow">Excedente individual</p><h2><Money value={totalExcess} /></h2><p>Soma mensal do dia a dia.</p></article><article className="panel"><p className="eyebrow">Contribuição mensal</p><h2><Money value={totalContributions} /></h2><p>Total calculado para a conta conjunta.</p></article><article className="panel"><p className="eyebrow">Fundo de emergência</p><h2><Money value={totalEmergency} /></h2><p>Soma dos valores individuais.</p></article></section><section className="settings-section"><div className="section-title"><div><p className="eyebrow">Contas</p><h2>Contas disponíveis</h2></div><span className="settings-status">{state.configuration.accounts.length} contas</span></div><div className="account-grid">{state.configuration.accounts.map((account) => <div className="account-card" key={account.id}><span className="icon-badge">€</span><strong>{account.name}</strong><small>Conta ativa</small></div>)}</div></section></main>;
}
