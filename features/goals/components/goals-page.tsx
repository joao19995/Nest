"use client";

import { useEffect, useState } from "react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { AppNav } from "@/shared/ui/app-nav";
import { annualAmountsFor, isValidTemplateTotal, suggestMonthlyFromTemplate, totalPercentage } from "../domain/goal-template";
import type { GoalTemplate, GoalTemplateEntry } from "../domain/goal-template";
import type { Goal } from "../domain/types";
import type { MonthFunding, YearFunding } from "@/shared/lib/goal-funding";
import type { GoalPlanView } from "@/shared/repositories/goal-plan-repository";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

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

type TemplateRow = GoalTemplateEntry;

export function GoalsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plan, setPlan] = useState<GoalPlanView | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [suggestionNote, setSuggestionNote] = useState("");
  // Template anual: valor do ano calculado + % ou € por objetivo = 100%.
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [templateDate, setTemplateDate] = useState(currentMonth());
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>([]);
  const [templateError, setTemplateError] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  // Funding calculado (não editável): resto do ordenado por mês e total do ano.
  const [yearFunding, setYearFunding] = useState<YearFunding | null>(null);
  const [monthFunding, setMonthFunding] = useState<MonthFunding | null>(null);

  const year = Number(month.slice(0, 4));

  async function reloadGoals() {
    setGoals(await entitiesClient.getGoals());
  }

  async function reloadTemplates() {
    setTemplates(await entitiesClient.getGoalTemplates());
  }

  useEffect(() => {
    Promise.all([reloadGoals(), reloadTemplates()]).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os objetivos."),
    );
  }, []);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError("");
    setDrafts({});
    setSuggestionNote("");
    setMonthFunding(null);
    Promise.all([entitiesClient.getGoalPlan(month), entitiesClient.getGoalsFundingByMonth(month)]).then(([loaded, funding]) => {
      if (!active) return;
      setPlan(loaded);
      setMonthFunding(funding);
      setStatus(loaded ? "ready" : "missing");
    }).catch((cause) => {
      if (!active) return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o mês.");
      setStatus("missing");
    });
    return () => { active = false; };
  }, [month]);

  useEffect(() => {
    let active = true;
    entitiesClient.getGoalsFundingByYear(year).then((funding) => {
      if (active) setYearFunding(funding);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Não foi possível calcular o valor anual.");
    });
    return () => { active = false; };
  }, [year]);

  const applicableTemplate = templates.filter((item) => item.validFrom <= month).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1) ?? null;
  const existingTemplate = templates.find((item) => item.validFrom === templateDate) ?? null;
  const isNewTemplateVersion = existingTemplate === null;
  const annualTotal = yearFunding?.annualTotal ?? 0;
  const templatePct = totalPercentage(templateRows);
  const templateValid = isValidTemplateTotal(templateRows);
  const templateAmounts = new Map(annualAmountsFor(annualTotal, templateRows).map((item) => [item.goalId, item.amount]));

  function goalName(goalId: string) {
    return goals.find((item) => item.id === goalId)?.name ?? "Objetivo";
  }

  function openTemplateEditor() {
    setTemplateError("");
    const base = existingTemplate ?? applicableTemplate;
    const baseRows = new Map(base?.entries.map((entry) => [entry.goalId, entry]));
    setTemplateRows(
      goals.map((item) => {
        const found = baseRows.get(item.id);
        return {
          goalId: item.id,
          percentage: found?.percentage ?? 0,
          priority: found?.priority ?? "MEDIUM",
          deadlineMonth: found?.deadlineMonth ?? null,
        };
      }),
    );
  }

  function updateTemplateRow(goalId: string, changes: Partial<TemplateRow>) {
    setTemplateRows((current) => current.map((row) => (row.goalId === goalId ? { ...row, ...changes } : row)));
  }

  // Edição pelo valor: converte € em % sobre o total anual calculado.
  function updateTemplateAmount(goalId: string, amount: number) {
    if (!Number.isFinite(amount) || amount < 0 || annualTotal <= 0) return;
    updateTemplateRow(goalId, { percentage: Math.round((amount / annualTotal) * 10000) / 100 });
  }

  async function saveTemplate() {
    setTemplateError("");
    if (!MONTH_PATTERN.test(templateDate)) {
      setTemplateError("Indica um mês de início válido (YYYY-MM).");
      return;
    }
    if (!yearFunding) {
      setTemplateError("Aguarda o cálculo do valor anual.");
      return;
    }
    if (!templateValid) {
      setTemplateError(`A tabela tem de somar 100% (atual: ${templatePct.toFixed(2)}%).`);
      return;
    }
    setTemplateSaving(true);
    try {
      const result = existingTemplate
        ? await entitiesClient.updateGoalTemplate(existingTemplate.id, { annualTotal: yearFunding.annualTotal, entries: templateRows })
        : await entitiesClient.createGoalTemplate({ validFrom: templateDate, annualTotal: yearFunding.annualTotal, entries: templateRows });
      setTemplates((current) => [...current.filter((item) => item.id !== result.id), result].sort((a, b) => a.validFrom.localeCompare(b.validFrom)));
    } catch (cause) {
      setTemplateError(cause instanceof Error ? cause.message : "Não foi possível guardar o template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function createGoal() {
    setError("");
    if (!name.trim()) {
      setError("Indica um nome para o objetivo.");
      return;
    }
    setBusy(true);
    try {
      await entitiesClient.createGoal({ name: name.trim() });
      setName("");
      await reloadGoals();
      const reloaded = await entitiesClient.getGoalPlan(month);
      if (reloaded) {
        setPlan(reloaded);
        setStatus("ready");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o objetivo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename(goalId: string) {
    if (!editingName.trim()) {
      setError("Indica um nome até 100 caracteres.");
      return;
    }
    setBusy(true);
    try {
      await entitiesClient.renameGoal(goalId, editingName.trim());
      setEditingGoalId(null);
      await reloadGoals();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível editar o objetivo.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGoal(goalId: string, goalLabel: string) {
    if (!window.confirm(`Apagar o objetivo ${goalLabel}? Sai das próximas tabelas; os meses fechados mantêm-se.`)) return;
    setBusy(true);
    try {
      await entitiesClient.deleteGoal(goalId);
      await reloadGoals();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível apagar o objetivo.");
    } finally {
      setBusy(false);
    }
  }

  async function createMonth() {
    setError("");
    setBusy(true);
    try {
      setPlan(await entitiesClient.createGoalPlan(month));
      setStatus("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o mês.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshMonth() {
    if (!plan || plan.closed) return;
    setBusy(true);
    try {
      setPlan(await entitiesClient.refreshGoalPlan(plan.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recalcular o mês.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCell(goalId: string, field: "planned" | "actual") {
    if (!plan || plan.closed) return;
    const key = `${goalId}:${field}`;
    const raw = drafts[key];
    if (raw === undefined) return;
    const value = Number(raw);
    setDrafts((current) => { const next = { ...current }; delete next[key]; return next; });
    if (!Number.isFinite(value) || value < 0) {
      setError("Os valores devem ser números não negativos.");
      return;
    }
    try {
      setPlan(await entitiesClient.updateGoalAllocation(plan.id, goalId, { [field]: value }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a alocação.");
    }
  }

  async function suggest() {
    if (!plan || plan.closed) return;
    setError("");
    setSuggestionNote("");
    setBusy(true);
    try {
      const template = await entitiesClient.getApplicableGoalTemplate(month);
      if (!template || !template.entries.length) {
        setSuggestionNote("Cria primeiro a tabela anual para sugerir a distribuição.");
        return;
      }
      const { suggestions, undistributed } = suggestMonthlyFromTemplate({
        availableAmount: plan.availableAmount,
        entries: template.entries,
        month,
      });
      for (const item of suggestions) {
        await entitiesClient.updateGoalAllocation(plan.id, item.goalId, { planned: Math.round(item.planned * 100) / 100 });
      }
      setPlan(await entitiesClient.getGoalPlan(month));
      setSuggestionNote(
        undistributed > 0.005
          ? `Sugestão do template aplicada. ${euro(undistributed)} por distribuir (prazo vencido ou arredondamento).`
          : "Sugestão do template aplicada: o mês distribui 100% do disponível.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível sugerir a distribuição.");
    } finally {
      setBusy(false);
    }
  }

  async function closeMonth() {
    if (!plan || plan.closed) return;
    if (!window.confirm(`Fechar planeamento de objetivos de ${displayMonth(month)}? Depois não pode ser alterado.`)) return;
    setBusy(true);
    try {
      setPlan(await entitiesClient.closeGoalPlan(plan.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível fechar o mês.");
    } finally {
      setBusy(false);
    }
  }

  const totalPlanned = plan?.allocations.reduce((total, item) => total + item.planned, 0) ?? 0;
  const totalActual = plan?.allocations.reduce((total, item) => total + item.actual, 0) ?? 0;
  const snapshotDiffers = plan && monthFunding && Math.abs(plan.availableAmount - monthFunding.available) > 0.005;

  return (
    <main className="shell compact-shell">
      <AppNav active="goals" />
      <div className="page-heading">
        <p className="eyebrow">Objetivos anuais</p>
        <h1>{displayMonth(month)}</h1>
        <p className="lede">Reserva mensal por objetivo. Meses fechados são apenas leitura e nunca mudam.</p>
      </div>

      <div className="month-controls">
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, -1))} aria-label="Mês anterior">‹</button>
        <span className="month-current">{displayMonth(month)}</span>
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, 1))} aria-label="Mês seguinte">›</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="settings-section">
        <div className="section-title">
          <div><p className="eyebrow">Template anual</p><h2>Valor do ano e distribuição</h2></div>
          <div className="entity-action-buttons">
            <label className="template-date">Aplicável a partir de <input type="month" value={templateDate} onChange={(event) => { if (MONTH_PATTERN.test(event.target.value)) setTemplateDate(event.target.value); }} /></label>
            <button className="secondary-button" onClick={openTemplateEditor} disabled={!goals.length}>Editar tabela</button>
          </div>
        </div>
        <p className="form-note">
          Valor final do ano calculado: {yearFunding ? euro(yearFunding.annualTotal) : "a calcular…"} (soma dos 12 disponíveis mensais).
          {applicableTemplate ? ` Template a partir de ${applicableTemplate.validFrom}.` : " Sem tabela: cria no início do ano."}
          {isNewTemplateVersion && applicableTemplate ? ` Ao guardar cria-se nova versão a partir de ${templateDate}, sem mexer nos meses fechados.` : ""}
        </p>
        {templateRows.length > 0 && (
          <>
            <div className="category-table">
              <div className="category-table-row">
                <strong>Valor final do ano (calculado)</strong>
                <span>{yearFunding ? euro(yearFunding.annualTotal) : "…"}</span>
                <span>Total: {templatePct.toFixed(2)}% {templateValid ? "✓" : "(tem de dar 100%)"}</span>
              </div>
            </div>
            <div className="category-table">
              <div className="category-table-row category-table-header"><span>Objetivo</span><span>%</span><span>Orçamento</span><span>Prioridade</span><span>Prazo</span></div>
              {templateRows.map((row) => (
                <div className="category-table-row" key={row.goalId}>
                  <strong>{goalName(row.goalId)}</strong>
                  <span><input aria-label={`Percentagem de ${goalName(row.goalId)}`} type="number" min="0" max="100" step="0.01"
                    value={row.percentage}
                    onChange={(event) => updateTemplateRow(row.goalId, { percentage: Number(event.target.value) })} /></span>
                  <span><input aria-label={`Orçamento de ${goalName(row.goalId)}`} type="number" min="0" step="0.01"
                    value={Math.round((templateAmounts.get(row.goalId) ?? 0) * 100) / 100}
                    onChange={(event) => updateTemplateAmount(row.goalId, Number(event.target.value))} /></span>
                  <span><select aria-label={`Prioridade de ${goalName(row.goalId)}`} value={row.priority}
                    onChange={(event) => updateTemplateRow(row.goalId, { priority: event.target.value as TemplateRow["priority"] })}>
                    <option value="HIGH">Alta</option>
                    <option value="MEDIUM">Média</option>
                    <option value="LOW">Baixa</option>
                  </select></span>
                  <span><input aria-label={`Prazo de ${goalName(row.goalId)}`} type="month" value={row.deadlineMonth ?? ""}
                    onChange={(event) => updateTemplateRow(row.goalId, { deadlineMonth: event.target.value || null })} /></span>
                </div>
              ))}
            </div>
            {templateError && <p className="form-error" role="alert">{templateError}</p>}
            <div className="editor-actions">
              <button className="save-button" onClick={() => void saveTemplate()} disabled={templateSaving || !templateValid || !yearFunding}>
                {templateSaving ? "A guardar…" : isNewTemplateVersion ? "Criar tabela (100%)" : "Guardar tabela (100%)"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Objetivos</p><h2>Objetivos</h2></div></div>
        <div className="category-table">
          <div className="category-table-row">
            <input aria-label="Nome do objetivo" placeholder="Viagem ao Brasil" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
        </div>
        <div className="editor-actions">
          <button className="save-button" onClick={() => void createGoal()} disabled={busy}>{busy ? "A guardar…" : "Criar objetivo"}</button>
        </div>
        {goals.length > 0 && (
          <div className="category-table">
            <div className="category-table-row category-table-header"><span>Objetivo</span><span>Ação</span></div>
            {goals.map((item) => (
              <div className="category-table-row" key={item.id}>
                {editingGoalId === item.id ? (
                  <>
                    <span><input aria-label={`Nome de ${item.name}`} maxLength={100} value={editingName} onChange={(event) => setEditingName(event.target.value)} /></span>
                    <div className="entity-action-buttons">
                      <button className="save-button" onClick={() => void saveRename(item.id)} disabled={busy}>Guardar</button>
                      <button className="secondary-button" onClick={() => setEditingGoalId(null)}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{item.name}</strong>
                    <div className="entity-action-buttons">
                      <button className="entity-edit-button" type="button" title={`Editar ${item.name}`} aria-label={`Editar ${item.name}`}
                        onClick={() => { setEditingGoalId(item.id); setEditingName(item.name); }}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                      </button>
                      <button className="entity-edit-button entity-remove-button" type="button" title={`Apagar ${item.name}`} aria-label={`Apagar ${item.name}`}
                        onClick={() => void removeGoal(item.id, item.name)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {status === "loading" && <p className="form-note">A carregar o mês…</p>}

      {status === "missing" && (
        <section className="settings-section">
          <p className="form-note">
            {monthFunding
              ? `Disponível calculado para este mês: ${euro(monthFunding.available)} (ordenado ${euro(monthFunding.incomeNormal)} − contribuição ${euro(monthFunding.contributionRequired)} − diário ${euro(monthFunding.dailyAllowance)}${monthFunding.bonus > 0 ? ` + bónus ${euro(monthFunding.bonus)}` : ""}).`
              : "A calcular o disponível…"}
          </p>
          <div className="editor-actions"><button className="save-button" onClick={() => void createMonth()} disabled={busy || !monthFunding}>{busy ? "A criar…" : "Criar mês"}</button></div>
        </section>
      )}

      {status === "ready" && plan && (
        <>
          {plan.closed && <p className="form-note">Mês fechado — apenas leitura.</p>}
          <section className="category-totals">
            <article className="panel"><p className="eyebrow">Disponível (calculado)</p><h2>{euro(plan.availableAmount)}</h2><p>Resto do ordenado do mês.</p></article>
            <article className="panel"><p className="eyebrow">Reservado</p><h2>{euro(totalPlanned)}</h2><p>Soma dos planeados.</p></article>
            <article className="panel"><p className="eyebrow">Executado</p><h2>{euro(totalActual)}</h2><p>Soma dos reais.</p></article>
          </section>

          <section className="settings-section">
            <div className="section-title"><div><p className="eyebrow">Mês</p><h2>Disponível e alocações</h2></div></div>
            <div className="category-table"><div className="category-table-row">
              <strong>Disponível para objetivos</strong>
              <span>{euro(plan.availableAmount)}</span>
              <span>{euro(plan.availableAmount - totalPlanned)} por distribuir</span>
            </div></div>
            {monthFunding && <p className="form-note">Cálculo: ordenado {euro(monthFunding.incomeNormal)} − contribuição {euro(monthFunding.contributionRequired)} − diário {euro(monthFunding.dailyAllowance)}{monthFunding.bonus > 0 ? ` + bónus ${euro(monthFunding.bonus)}` : ""}.</p>}
            {!plan.closed && snapshotDiffers && monthFunding && (
              <div className="editor-actions">
                <button className="secondary-button" onClick={() => void refreshMonth()} disabled={busy}>Recalcular disponível ({euro(monthFunding.available)})</button>
              </div>
            )}
            <div className="category-table month-table">
              <div className="category-table-row category-table-header"><span>Objetivo</span><span>Reservado</span><span>Executado</span></div>
              {plan.allocations.map((item) => (
                <div className="category-table-row" key={item.goalId}>
                  <strong>{item.goalName}</strong>
                  <span><input type="number" min="0" step="0.01" aria-label={`Reservado de ${item.goalName}`} disabled={plan.closed}
                    value={drafts[`${item.goalId}:planned`] ?? item.planned}
                    onChange={(event) => setDrafts((current) => ({ ...current, [`${item.goalId}:planned`]: event.target.value }))}
                    onBlur={() => void saveCell(item.goalId, "planned")} /></span>
                  <span><input type="number" min="0" step="0.01" aria-label={`Executado de ${item.goalName}`} disabled={plan.closed}
                    value={drafts[`${item.goalId}:actual`] ?? item.actual}
                    onChange={(event) => setDrafts((current) => ({ ...current, [`${item.goalId}:actual`]: event.target.value }))}
                    onBlur={() => void saveCell(item.goalId, "actual")} /></span>
                </div>
              ))}
            </div>
            {suggestionNote && <p className="form-note">{suggestionNote}</p>}
            {!plan.closed && (
              <div className="editor-actions">
                <button className="save-button" onClick={() => void suggest()} disabled={busy}>{busy ? "A sugerir…" : "Sugerir distribuição"}</button>
                <button className="save-button" onClick={() => void closeMonth()} disabled={busy}>{busy ? "A fechar…" : "Fechar mês"}</button>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
