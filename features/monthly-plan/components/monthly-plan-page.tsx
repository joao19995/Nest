"use client";

import { useEffect, useState } from "react";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { entitiesClient } from "@/shared/lib/entities-client";
import { loadFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { calculateMonthContributions, totalActual, totalPlanned } from "../domain/month-planning";
import type { FinanceState, MonthlyPlanEntryView, MonthlyPlanView } from "../domain/types";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + delta);
  return date.toISOString().slice(0, 7);
}

function displayMonth(month: string) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function euro(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

export function MonthlyPlanPage() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [month, setMonth] = useState(currentMonth());
  const [plan, setPlan] = useState<MonthlyPlanView | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadFinanceState(initialFinanceState).then(setState).catch(showFinanceStorageError);
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    setDrafts({});
    entitiesClient.getMonthlyPlan(month).then((loaded) => {
      if (!active) return;
      setPlan(loaded);
      setStatus(loaded ? "ready" : "missing");
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o mês.");
      setStatus("missing");
    });
    return () => { active = false; };
  }, [month]);

  async function createPlan() {
    setError("");
    setBusy(true);
    try {
      setPlan(await entitiesClient.createMonthlyPlan(month));
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o mês.");
    } finally {
      setBusy(false);
    }
  }

  // Persiste o actual assim que o campo perde o foco (sem botão global de guardar).
  async function saveActual(entry: MonthlyPlanEntryView) {
    const raw = drafts[entry.id];
    if (!plan || plan.closed || raw === undefined) return;
    const value = Number(raw);
    setDrafts((current) => { const next = { ...current }; delete next[entry.id]; return next; });
    if (raw.trim() === "" || !Number.isFinite(value) || value < 0) {
      setError("O valor actual deve ser um número não negativo.");
      return;
    }
    if (value === entry.actual) return;
    setError("");
    try {
      setPlan(await entitiesClient.updateMonthlyPlanActual(plan.id, entry.id, value));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o valor actual.");
    }
  }

  async function closePlan() {
    if (!plan || plan.closed) return;
    if (!window.confirm(`Fechar ${displayMonth(month)}? Depois de fechado não pode ser alterado.`)) return;
    setError("");
    setBusy(true);
    try {
      setPlan(await entitiesClient.closeMonthlyPlan(plan.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível fechar o mês.");
    } finally {
      setBusy(false);
    }
  }

  const entries = plan?.entries ?? [];
  const planned = totalPlanned(entries);
  const actual = totalActual(entries.map((entry) => ({ actual: displayedActual(entry) })));
  const contributions = plan
    ? calculateMonthContributions({ month, entries, personIds: state.configuration.people.map((person) => person.id), incomes: state.configuration.personIncomes })
    : null;

  function displayedActual(entry: MonthlyPlanEntryView) {
    const raw = drafts[entry.id];
    if (raw === undefined) return entry.actual;
    const value = Number(raw);
    return Number.isFinite(value) ? value : entry.actual;
  }

  return (
    <main className="shell compact-shell">
      <AppNav active="month" />
      <div className="page-heading">
        <p className="eyebrow">Execução mensal</p>
        <h1>{displayMonth(month)}</h1>
        <p className="lede">Os valores planeados vêm do template aplicável e ficam fixos. Preenche os valores reais.</p>
      </div>

      <div className="month-controls">
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, -1))} aria-label="Mês anterior">‹</button>
        <span className="month-current">{displayMonth(month)}</span>
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, 1))} aria-label="Mês seguinte">›</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {status === "loading" && <p className="form-note">A carregar o mês…</p>}

      {status === "missing" && <section className="settings-section">
        <p className="form-note">Este mês ainda não foi criado. Ao criar, copia-se o template aplicável a {displayMonth(month)}.</p>
        <div className="editor-actions"><button className="save-button" onClick={() => void createPlan()} disabled={busy}>{busy ? "A criar…" : "Criar mês"}</button></div>
      </section>}

      {status === "ready" && plan && <>
        {plan.closed && <p className="form-note">Mês fechado — apenas leitura.</p>}

        <section className="category-totals">
          <article className="panel"><p className="eyebrow">Total planeado</p><h2>{euro(planned)}</h2><p>Snapshot do template.</p></article>
          <article className="panel"><p className="eyebrow">Total actual</p><h2>{euro(actual)}</h2><p>Valores reais introduzidos.</p></article>
          <article className="panel"><p className="eyebrow">Diferença</p><h2>{euro(actual - planned)}</h2><p>Actual − planeado.</p></article>
        </section>

        <section className="settings-section">
          <div className="section-title"><div><p className="eyebrow">Despesas</p><h2>Planeado e actual</h2></div></div>
          <div className="category-table month-table">
            <div className="category-table-row category-table-header"><span>Categoria</span><span>Conta</span><span>Planeado</span><span>Actual</span><span>Diferença</span></div>
            {entries.map((entry) => {
              const value = displayedActual(entry);
              return <div className="category-table-row" key={entry.id}>
                <strong>{entry.categoryName}</strong>
                <span>{entry.accountName}</span>
                <span>{euro(entry.planned)}</span>
                <span>
                  <input type="number" min="0" step="0.01" aria-label={`Valor actual de ${entry.categoryName}`} disabled={plan.closed}
                    value={drafts[entry.id] ?? entry.actual}
                    onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
                    onBlur={() => void saveActual(entry)} />
                </span>
                <span>{euro(value - entry.planned)}</span>
              </div>;
            })}
          </div>
        </section>

        <section className="settings-section">
          <div className="section-title"><div><p className="eyebrow">Contribuições</p><h2>Quanto cada pessoa transfere</h2></div></div>
          {contributions?.status === "no-income" && <p className="form-error" role="alert">{contributions.message}</p>}
          {contributions?.status === "ok" && <>
            <p className="form-note">Quota total (despesas reais comuns): {euro(contributions.contributionRequired)} (actual, sem margem).</p>
            <div className="category-table month-contributions">
              <div className="category-table-row category-table-header"><span>Pessoa</span><span>Quota</span><span>Já pago pela conta pessoal</span><span>A transferir para a conjunta</span><span>A receber da conjunta</span></div>
              {contributions.people.map((item) => <div className="category-table-row" key={item.personId}>
                <strong>{state.configuration.people.find((person) => person.id === item.personId)?.name ?? "—"}</strong>
                <span>{euro(item.quota)}</span>
                <span>{euro(item.personalActual)}</span>
                <span>{euro(item.transferToJoint)}</span>
                <span>{euro(item.transferToPerson)}</span>
              </div>)}
            </div>
          </>}
        </section>

        {!plan.closed && <div className="editor-actions"><button className="save-button" onClick={() => void closePlan()} disabled={busy}>{busy ? "A fechar…" : "Fechar mês"}</button></div>}
      </>}
    </main>
  );
}
