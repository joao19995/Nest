"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { calculateMonthlyPlan } from "@/features/monthly-plan/domain/calculate-monthly-plan";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { entitiesClient } from "@/shared/lib/entities-client";
import { loadFinanceState, saveFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { Account, FinanceState } from "@/features/monthly-plan/domain/types";

type SalaryDraft = { amount: number; validFrom: string };
type AccountDraft = { name: string; ownerPersonId: string | null };

export function PeopleEditor() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [drafts, setDrafts] = useState<Record<string, SalaryDraft>>({});
  const [personNames, setPersonNames] = useState<Record<string, string>>({});
  const [accountDrafts, setAccountDrafts] = useState<Record<string, AccountDraft>>({});
  const [newPersonName, setNewPersonName] = useState("");
  const [newAccount, setNewAccount] = useState<AccountDraft>({ name: "", ownerPersonId: null });
  const [emergencyMonths, setEmergencyMonths] = useState(initialFinanceState.configuration.emergencyFundMonths);
  const [dailyPercentage, setDailyPercentage] = useState(initialFinanceState.configuration.dailySpendingPercentage);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadFinanceState(initialFinanceState).then((loaded) => {
      if (!active) return;
      setState(loaded);
      setEmergencyMonths(loaded.configuration.emergencyFundMonths);
      setDailyPercentage(loaded.configuration.dailySpendingPercentage);
      setDrafts(Object.fromEntries(loaded.configuration.people.map((person) => {
        const income = loaded.configuration.incomes.find((item) => item.personId === person.id);
        const latest = income?.periods.at(-1) ?? { amount: 0, validFrom: "2026-10" };
        return [person.id, latest];
      })));
      setPersonNames(Object.fromEntries(loaded.configuration.people.map((person) => [person.id, person.name])));
      setAccountDrafts(Object.fromEntries(loaded.configuration.accounts.map((account) => [account.id, { name: account.name, ownerPersonId: account.ownerPersonId }])));
    }).catch(showFinanceStorageError);
    return () => { active = false; };
  }, []);

  const referenceMonth = state.months[0] ?? { month: "2026-10", expenses: [] };
  const planYear = Number(referenceMonth.month.slice(0, 4));
  const annualPlan = state.annualPlans.find((plan) => plan.year === planYear) ?? { year: planYear, allocations: [] };
  const calculation = calculateMonthlyPlan(state.configuration, annualPlan, referenceMonth);
  const totalIncome = state.configuration.people.reduce((sum, person) => sum + (drafts[person.id]?.amount ?? 0), 0);
  const totalExcess = totalIncome * dailyPercentage / 100;
  const totalSubsidies = state.configuration.incomes.reduce((sum, income) => sum + (drafts[income.personId]?.amount ?? 0) * income.bonusMonths.length, 0);
  const totalContributions = calculation.transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  const totalEmergency = calculation.emergencyFund;

  function updateDraft(personId: string, field: keyof SalaryDraft, value: string) {
    setDrafts((current) => ({ ...current, [personId]: { ...current[personId], [field]: field === "amount" ? Number(value) : value } }));
    setSaved(false);
  }

  function save() {
    const incomes = state.configuration.incomes.map((income) => {
      const draft = drafts[income.personId];
      if (!draft) return income;
      const periods = [...income.periods.filter((period) => period.validFrom !== draft.validFrom), { amount: draft.amount, validFrom: draft.validFrom }].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
      return { ...income, periods };
    });
    const nextState = { ...state, configuration: { ...state.configuration, incomes, emergencyFundMonths: emergencyMonths, dailySpendingPercentage: dailyPercentage } };
    setState(nextState);
    saveFinanceState(nextState);
    setSaved(true);
  }

  async function createPerson() {
    setError("");
    try {
      const person = await entitiesClient.createPerson(newPersonName);
      const validFrom = new Date().toISOString().slice(0, 7);
      const nextState = {
        ...state,
        configuration: {
          ...state.configuration,
          people: [...state.configuration.people, person],
          incomes: [...state.configuration.incomes, { personId: person.id, periods: [{ amount: 0, validFrom }], bonusMonths: [] }],
          contributionRules: [...state.configuration.contributionRules, { personId: person.id, minimumAmount: 0 }],
        },
      };
      setState(nextState);
      saveFinanceState(nextState);
      setDrafts((current) => ({ ...current, [person.id]: { amount: 0, validFrom } }));
      setPersonNames((current) => ({ ...current, [person.id]: person.name }));
      setNewPersonName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a pessoa.");
    }
  }

  async function updatePerson(id: string) {
    setError("");
    try {
      const person = await entitiesClient.updatePerson(id, personNames[id] ?? "");
      setState((current) => ({ ...current, configuration: { ...current.configuration, people: current.configuration.people.map((item) => item.id === id ? person : item) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a pessoa.");
    }
  }

  async function createAccount() {
    setError("");
    try {
      const account = await entitiesClient.createAccount(newAccount.name, newAccount.ownerPersonId);
      setState((current) => ({ ...current, configuration: { ...current.configuration, accounts: [...current.configuration.accounts, account] } }));
      setAccountDrafts((current) => ({ ...current, [account.id]: { name: account.name, ownerPersonId: account.ownerPersonId } }));
      setNewAccount({ name: "", ownerPersonId: null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a conta.");
    }
  }

  async function updateAccount(id: string) {
    setError("");
    const draft = accountDrafts[id];
    if (!draft) return;
    try {
      const account = await entitiesClient.updateAccount(id, draft.name, draft.ownerPersonId);
      setState((current) => ({ ...current, configuration: { ...current.configuration, accounts: current.configuration.accounts.map((item) => item.id === id ? account : item) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a conta.");
    }
  }

  function changeAccount(id: string, changes: Partial<AccountDraft>) {
    setAccountDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
  }

  return (
    <main className="shell compact-shell">
      <AppNav active="people" />
      <div className="page-heading">
        <Link className="back-link" href="/">← Dashboard</Link>
        <p className="eyebrow">Vencimentos</p>
        <h1>Valores mensais</h1>
        <p className="lede">Valores mensais de referência. O histórico de salários é usado nos cálculos dos meses futuros.</p>
        <div className="people-rules">
          <label className="emergency-month-setting">Meses do fundo de emergência<input type="number" value={emergencyMonths} onChange={(event) => { setEmergencyMonths(Number(event.target.value)); setSaved(false); }} /></label>
          <label className="emergency-month-setting">Gastos do dia a dia (%)<input type="number" value={dailyPercentage} onChange={(event) => { setDailyPercentage(Number(event.target.value)); setSaved(false); }} /></label>
        </div>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Pessoas</p><h2>Gerir pessoas</h2></div><span className="settings-status">PostgreSQL</span></div>
        <div className="entity-create-row">
          <label>Nome da pessoa<input value={newPersonName} onChange={(event) => setNewPersonName(event.target.value)} maxLength={100} /></label>
          <button className="secondary-button" onClick={createPerson}>+ Adicionar pessoa</button>
        </div>
        <div className="entity-list">
          {state.configuration.people.map((person) => (
            <div className="entity-row" key={person.id}>
              <label>Nome<input value={personNames[person.id] ?? person.name} onChange={(event) => setPersonNames((current) => ({ ...current, [person.id]: event.target.value }))} maxLength={100} /></label>
              <button className="secondary-button" onClick={() => updatePerson(person.id)}>Guardar pessoa</button>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Contas</p><h2>Gerir contas</h2></div><span className="settings-status">PostgreSQL</span></div>
        <div className="entity-create-row">
          <label>Nome da conta<input value={newAccount.name} onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))} maxLength={100} /></label>
          <label>Proprietário<select value={newAccount.ownerPersonId ?? ""} onChange={(event) => setNewAccount((current) => ({ ...current, ownerPersonId: event.target.value || null }))}><option value="">Sem proprietário</option>{state.configuration.people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
          <button className="secondary-button" onClick={createAccount}>+ Adicionar conta</button>
        </div>
        <div className="entity-list">
          {state.configuration.accounts.map((account: Account) => {
            const draft = accountDrafts[account.id] ?? { name: account.name, ownerPersonId: account.ownerPersonId };
            return <div className="entity-row" key={account.id}>
              <label>Nome<input value={draft.name} onChange={(event) => changeAccount(account.id, { name: event.target.value })} maxLength={100} /></label>
              <label>Proprietário<select value={draft.ownerPersonId ?? ""} onChange={(event) => changeAccount(account.id, { ownerPersonId: event.target.value || null })}><option value="">Sem proprietário</option>{state.configuration.people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
              <button className="secondary-button" onClick={() => updateAccount(account.id)}>Guardar conta</button>
            </div>;
          })}
        </div>
      </section>

      <div className="editor-actions"><button className="save-button" onClick={save}>{saved ? "Guardado" : "Guardar alterações"}</button></div>
      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Valores mensais</p><h2>Salário e regras calculadas</h2></div><span className="settings-status">Contribuição não editável</span></div>
        <div className="salary-table">
          <div className="salary-row salary-row-wide salary-header"><span>Pessoa</span><span>Vencimento mensal</span><span>Subsídios</span><span>Excedente individual</span><span>Contribuição</span><span>Fundo emergência</span></div>
          {state.configuration.people.map((person) => {
            const income = state.configuration.incomes.find((item) => item.personId === person.id);
            const latest = income?.periods.at(-1) ?? { amount: 0, validFrom: referenceMonth.month };
            const draft = drafts[person.id] ?? latest;
            const dailySurplus = draft.amount * dailyPercentage / 100;
            const transfer = calculation.transfers.find((item) => item.personId === person.id);
            const share = totalIncome > 0 ? draft.amount / totalIncome : 0;
            const emergencyValue = totalEmergency * share;
            const subsidyTotal = draft.amount * (income?.bonusMonths.length ?? 0);
            return <div className="salary-row salary-row-wide" key={person.id}>
              <strong>{person.name}</strong>
              <label><input className="salary-input" type="number" value={draft.amount} onChange={(event) => updateDraft(person.id, "amount", event.target.value)} /><small>Desde <input className="date-input" type="month" value={draft.validFrom} onChange={(event) => updateDraft(person.id, "validFrom", event.target.value)} /></small></label>
              <span><Money value={subsidyTotal} /><small>{income?.bonusMonths.length ?? 0} subsídios anuais</small></span>
              <span><Money value={dailySurplus} /><small>{dailyPercentage}% individual</small></span>
              <span><Money value={transfer?.amount ?? 0} /><small>calculada para a conjunta</small></span>
              <span><Money value={emergencyValue} /><small>{(share * 100).toFixed(0)}% do fundo</small></span>
            </div>;
          })}
        </div>
      </section>

      <section className="salary-summary">
        <article className="panel"><p className="eyebrow">Rendimento mensal</p><h2><Money value={totalIncome} /></h2><p>Total de vencimentos de referência.</p></article>
        <article className="panel"><p className="eyebrow">Subsídios anuais</p><h2><Money value={totalSubsidies} /></h2><p>Estimativa baseada nos meses de subsídio.</p></article>
        <article className="panel"><p className="eyebrow">Gastos diários</p><h2><Money value={totalExcess} /></h2><p>Percentagem definida nas regras globais.</p></article>
        <article className="panel"><p className="eyebrow">Transferências</p><h2><Money value={totalContributions} /></h2><p>Valor mínimo calculado para a conjunta.</p></article>
      </section>
    </main>
  );
}
