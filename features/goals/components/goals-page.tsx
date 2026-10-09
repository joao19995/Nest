"use client";

import { useEffect, useMemo, useState } from "react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { AppNav } from "@/shared/ui/app-nav";
import { isValidTemplateTotal, totalPercentage } from "../domain/goal-template";
import type { GoalTemplateEntry } from "../domain/goal-template";
import type { Goal } from "../domain/types";
import type { YearFunding } from "@/shared/lib/goal-funding";
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

function shortMonth(month: string) {
  return new Intl.DateTimeFormat("pt-PT", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function euro(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

type FutureChange = {
  month: string;
  availableAmount: number;
  before: { goalId: string; planned: number }[];
  after: { goalId: string; planned: number }[];
};

type Preview = {
  month: string;
  availableAmount: number;
  newAllocations: { goalId: string; planned: number }[];
  futureChanges: FutureChange[];
  missingMonths: string[];
};

export function GoalsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [templates, setTemplates] = useState<import("../domain/goal-template").GoalTemplate[]>([]);
  const [yearPlans, setYearPlans] = useState<GoalPlanView[]>([]);
  const [yearFunding, setYearFunding] = useState<YearFunding | null>(null);
  const [yearLoading, setYearLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Painel A — template anual.
  const [templateDate, setTemplateDate] = useState(currentMonth());
  const [templateRows, setTemplateRows] = useState<GoalTemplateEntry[]>([]);
  const [templateEditing, setTemplateEditing] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [templateSaving, setTemplateSaving] = useState(false);
  const [inspectedVersion, setInspectedVersion] = useState<string | null>(null);

  // Painel B — gestão de objetivos (modal como nas categorias).
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalFormName, setGoalFormName] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormError, setGoalFormError] = useState("");

  // Painel C — revisão mensal.
  const [plannedDrafts, setPlannedDrafts] = useState<Record<string, string>>({});
  const [actualDrafts, setActualDrafts] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [monthNote, setMonthNote] = useState("");

  const year = Number(month.slice(0, 4));

  async function reloadCatalog() {
    const [loadedGoals, loadedTemplates] = await Promise.all([
      entitiesClient.getGoals(),
      entitiesClient.getGoalTemplates(),
    ]);
    setGoals(loadedGoals);
    setTemplates(loadedTemplates.sort((a, b) => a.validFrom.localeCompare(b.validFrom)));
  }

  async function reloadYear(targetYear: number) {
    setYearLoading(true);
    try {
      const { plans, funding } = await entitiesClient.getGoalYear(targetYear);
      setYearPlans(plans);
      setYearFunding(funding);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o ano.");
    } finally {
      setYearLoading(false);
    }
  }

  useEffect(() => {
    reloadCatalog().catch((cause) =>
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os objetivos."),
    );
  }, []);

  useEffect(() => {
    if (!goalModalOpen || savingGoal) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setGoalModalOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [goalModalOpen, savingGoal]);

  useEffect(() => {
    setPlannedDrafts({});
    setActualDrafts({});
    setPreview(null);
    setMonthNote("");
    void reloadYear(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const planByMonth = useMemo(() => new Map(yearPlans.map((item) => [item.month, item])), [yearPlans]);
  const fundingByMonth = useMemo(
    () => new Map((yearFunding?.months ?? []).map((item) => [item.month, item])),
    [yearFunding],
  );

  const plan = planByMonth.get(month) ?? null;
  const funding = fundingByMonth.get(month) ?? null;

  function goalName(goalId: string) {
    return goals.find((item) => item.id === goalId)?.name
      ?? plan?.allocations.find((item) => item.goalId === goalId)?.goalName
      ?? "Objetivo arquivado";
  }

  // ---- Painel A: template anual ----

  const existingTemplate = templates.find((item) => item.validFrom === templateDate) ?? null;
  const templatePct = totalPercentage(templateRows);
  const templateValid = templateRows.length > 0 && isValidTemplateTotal(templateRows);

  function openTemplateEditor() {
    setTemplateError("");
    const base = existingTemplate
      ?? templates.filter((item) => item.validFrom <= templateDate).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1)
      ?? null;
    const baseRows = new Map(base?.entries.map((entry) => [entry.goalId, entry]) ?? []);
    setTemplateRows(
      goals.map((item) => ({ goalId: item.id, percentage: baseRows.get(item.id)?.percentage ?? 0 })),
    );
    setTemplateEditing(true);
  }

  async function saveTemplate() {
    setTemplateError("");
    if (!MONTH_PATTERN.test(templateDate)) {
      setTemplateError("Indica um mês de início válido (YYYY-MM).");
      return;
    }
    if (!templateValid) {
      setTemplateError(`A tabela tem de somar 100% (atual: ${templatePct.toFixed(2)}%).`);
      return;
    }
    const annualTotal = yearFunding?.annualTotal ?? 0;
    setTemplateSaving(true);
    try {
      if (existingTemplate) {
        await entitiesClient.updateGoalTemplate(existingTemplate.id, { annualTotal, entries: templateRows });
      } else {
        await entitiesClient.createGoalTemplate({ validFrom: templateDate, annualTotal, entries: templateRows });
      }
      setTemplateEditing(false);
      setTemplateRows([]);
      await reloadCatalog();
      await reloadYear(year);
    } catch (cause) {
      setTemplateError(cause instanceof Error ? cause.message : "Não foi possível guardar o template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  // ---- Painel B: gestão de objetivos ----

  function openCreateGoal() {
    setEditingGoalId(null);
    setGoalFormName("");
    setGoalFormError("");
    setGoalModalOpen(true);
  }

  function openRenameGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalFormName(goal.name);
    setGoalFormError("");
    setGoalModalOpen(true);
  }

  async function saveGoal() {
    const trimmed = goalFormName.trim();
    if (!trimmed) {
      setGoalFormError("Indica um nome para o objetivo.");
      return;
    }
    if (trimmed.length > 100) {
      setGoalFormError("Indica um nome até 100 caracteres.");
      return;
    }
    setGoalFormError("");
    setSavingGoal(true);
    try {
      if (editingGoalId) {
        await entitiesClient.renameGoal(editingGoalId, trimmed);
      } else {
        await entitiesClient.createGoal({ name: trimmed });
      }
      setGoalModalOpen(false);
      await reloadCatalog();
    } catch (cause) {
      setGoalFormError(cause instanceof Error ? cause.message : "Não foi possível guardar o objetivo.");
    } finally {
      setSavingGoal(false);
    }
  }

  async function deactivateGoal(goalId: string, goalLabel: string) {
    if (!window.confirm(`Desativar o objetivo ${goalLabel}? Deixa de aparecer nas próximas tabelas; o histórico mantém-se.`)) return;
    setBusy(true);
    try {
      await entitiesClient.deleteGoal(goalId);
      await reloadCatalog();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desativar o objetivo.");
    } finally {
      setBusy(false);
    }
  }

  // ---- Painel C: revisão mensal ----

  const storedPlanned = useMemo(() => new Map((plan?.allocations ?? []).map((item) => [item.goalId, item.planned])), [plan]);
  const editedPlanned = useMemo(
    () => (plan?.allocations ?? []).map((item) => ({
      goalId: item.goalId,
      planned: plannedDrafts[item.goalId] === undefined ? item.planned : Number(plannedDrafts[item.goalId]),
    })),
    [plan, plannedDrafts],
  );
  const editedTotal = editedPlanned.reduce((sum, item) => sum + (Number.isFinite(item.planned) ? item.planned : 0), 0);
  const plannedDiff = plan ? plan.availableAmount - editedTotal : 0;
  const plannedDirty = editedPlanned.some((item) => Math.abs(item.planned - (storedPlanned.get(item.goalId) ?? 0)) > 0.005);
  const plannedInvalid = editedPlanned.some((item) => !Number.isFinite(item.planned) || item.planned < 0);

  async function createMonth() {
    setError("");
    setBusy(true);
    try {
      await entitiesClient.createGoalPlan(month);
      await reloadYear(year);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar o mês.");
    } finally {
      setBusy(false);
    }
  }

  async function recalculateYear() {
    setError("");
    setBusy(true);
    try {
      const result = await entitiesClient.recalcGoalYear(year);
      setYearPlans(result.plans);
      setYearFunding(result.funding);
      setMonthNote(
        result.missingMonths.length
          ? `Meses sem tabela aplicável (mantidos como estavam): ${result.missingMonths.join(", ")}.`
          : "Ano recalculado a partir do financiamento atual. Meses fechados intactos.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recalcular o ano.");
    } finally {
      setBusy(false);
    }
  }

  async function saveActual(goalId: string) {
    if (!plan || plan.closed) return;
    const raw = actualDrafts[goalId];
    if (raw === undefined) return;
    const value = Number(raw);
    setActualDrafts((current) => { const next = { ...current }; delete next[goalId]; return next; });
    if (!Number.isFinite(value) || value < 0) {
      setError("Os valores reservados devem ser números não negativos.");
      return;
    }
    try {
      await entitiesClient.updateGoalAllocation(plan.id, goalId, { actual: value });
      await reloadYear(year);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o valor reservado.");
    }
  }

  async function buildPreview() {
    if (!plan || plan.closed) return;
    setMonthNote("");
    if (plannedInvalid) {
      setMonthNote("Os valores planeados devem ser números não negativos.");
      return;
    }
    setPreviewBusy(true);
    try {
      const result = await entitiesClient.previewGoalAdjust(month, editedPlanned);
      setPreview(result);
      if (!result.futureChanges.length && !result.missingMonths.length) {
        setMonthNote("Antevisão pronta: nenhum futuro mês aberto muda com este ajuste.");
      }
    } catch (cause) {
      setMonthNote(cause instanceof Error ? cause.message : "Não foi possível pré-visualizar o ajuste.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function confirmAdjust() {
    if (!plan || plan.closed || !preview) return;
    if (!window.confirm(`Confirmar o ajuste de ${displayMonth(month)} e recalcular os futuros meses abertos?`)) return;
    setBusy(true);
    try {
      const result = await entitiesClient.applyGoalAdjust(month, editedPlanned);
      setYearPlans(result.plans);
      setPlannedDrafts({});
      setPreview(null);
      setMonthNote(
        result.missingMonths.length
          ? `Ajuste gravado. Meses sem tabela (não alterados): ${result.missingMonths.join(", ")}.`
          : "Ajuste gravado para o mês e futuros meses abertos.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível confirmar o ajuste.");
    } finally {
      setBusy(false);
    }
  }

  async function closeMonth() {
    if (!plan || plan.closed) return;
    if (!window.confirm(`Fechar ${displayMonth(month)}? O planeado e o reservado ficam imutáveis.`)) return;
    setBusy(true);
    try {
      await entitiesClient.closeGoalPlan(plan.id);
      await reloadYear(year);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível fechar o mês.");
    } finally {
      setBusy(false);
    }
  }

  const totalPlanned = plan?.allocations.reduce((sum, item) => sum + item.planned, 0) ?? 0;
  const totalActual = plan?.allocations.reduce((sum, item) => sum + item.actual, 0) ?? 0;

  return (
    <main className="shell compact-shell">
      <AppNav active="goals" />
      <div className="page-heading">
        <p className="eyebrow">Objetivos anuais</p>
        <h1>Plano anual de objetivos</h1>
        <p className="lede">100% do valor disponível depois das despesas e semanárias, pré-calculado para o ano. Meses fechados são imutáveis.</p>
      </div>

      <div className="month-controls">
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, -12))} aria-label="Ano anterior">«</button>
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, -1))} aria-label="Mês anterior">‹</button>
        <span className="month-current">{displayMonth(month)}</span>
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, 1))} aria-label="Mês seguinte">›</button>
        <button className="month-arrow" onClick={() => setMonth((current) => shiftMonth(current, 12))} aria-label="Ano seguinte">»</button>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      {/* Painel C — principal: visão anual e revisão mensal */}
      <section className="settings-section">
        <div className="section-title">
          <div><p className="eyebrow">Plano do ano {year}</p><h2>Visão anual e revisão mensal</h2></div>
          <div className="entity-action-buttons">
            <button className="secondary-button" onClick={() => void recalculateYear()} disabled={busy || yearLoading}>
              {busy ? "A recalcular…" : "Recalcular ano"}
            </button>
          </div>
        </div>
        <p className="form-note">
          Disponível anual: {yearFunding ? euro(yearFunding.annualTotal) : "a calcular…"}.
          Cada mês distribui 100% do seu disponível. <strong>Por validar</strong> = mês ainda sem plano gravado.
        </p>
        {yearLoading ? (
          <p className="form-note">A carregar o ano…</p>
        ) : (
          <div className="category-table month-table">
            <div className="category-table-row category-table-header">
              <span>Mês</span><span>Estado</span><span>Disponível</span><span>Planeado</span><span>Reservado</span>
            </div>
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`).map((item) => {
              const itemPlan = planByMonth.get(item);
              const itemFunding = fundingByMonth.get(item);
              const status = itemPlan ? (itemPlan.closed ? "Fechado" : "Aberto") : "Por validar";
              const isCurrent = item === currentMonth();
              const isSelected = item === month;
              return (
                <div
                  className="category-table-row"
                  key={item}
                  role="button"
                  tabIndex={0}
                  aria-label={`Rever ${displayMonth(item)}`}
                  onClick={() => setMonth(item)}
                  onKeyDown={(event) => { if (event.key === "Enter") setMonth(item); }}
                  style={isSelected ? { outline: "2px solid currentColor" } : undefined}
                >
                  <strong>{shortMonth(item)}{isCurrent ? " •" : ""}</strong>
                  <span>{status}</span>
                  <span>{itemFunding ? euro(itemFunding.available) : itemPlan ? euro(itemPlan.availableAmount) : "—"}</span>
                  <span>{itemPlan ? euro(itemPlan.allocations.reduce((sum, entry) => sum + entry.planned, 0)) : "—"}</span>
                  <span>{itemPlan ? euro(itemPlan.allocations.reduce((sum, entry) => sum + entry.actual, 0)) : "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {!yearLoading && !plan && (
        <section className="settings-section">
          <div className="section-title"><div><p className="eyebrow">Mês</p><h2>{displayMonth(month)}</h2></div></div>
          <p className="form-note">
            {funding
              ? `Disponível calculado: ${euro(funding.available)} (ordenado ${euro(funding.incomeNormal)} − contribuição ${euro(funding.contributionRequired)} − diário ${euro(funding.dailyAllowance)}${funding.bonus > 0 ? ` + bónus ${euro(funding.bonus)}` : ""}).`
              : "A calcular o disponível…"}
            {!templates.length ? " Cria primeiro a tabela anual (Painel A)." : ""}
          </p>
          <div className="editor-actions">
            <button className="save-button" onClick={() => void createMonth()} disabled={busy || !funding}>
              {busy ? "A criar…" : "Criar mês"}
            </button>
          </div>
        </section>
      )}

      {!yearLoading && plan && (
        <section className="settings-section">
          <div className="section-title">
            <div><p className="eyebrow">Revisão mensal</p><h2>{displayMonth(month)} {plan.closed ? "(Fechado)" : "(Aberto)"}</h2></div>
          </div>
          {plan.closed && <p className="form-note">Mês fechado — planeado e reservado são apenas leitura e nunca mudam.</p>}
          <section className="category-totals">
            <article className="panel"><p className="eyebrow">Disponível</p><h2>{euro(plan.availableAmount)}</h2></article>
            <article className="panel"><p className="eyebrow">Planeado</p><h2>{euro(totalPlanned)}</h2></article>
            <article className="panel"><p className="eyebrow">Reservado</p><h2>{euro(totalActual)}</h2></article>
            <article className="panel"><p className="eyebrow">Diferença</p><h2>{euro(plan.availableAmount - totalPlanned)}</h2></article>
          </section>
          {funding && <p className="form-note">Cálculo: ordenado {euro(funding.incomeNormal)} − contribuição {euro(funding.contributionRequired)} − diário {euro(funding.dailyAllowance)}{funding.bonus > 0 ? ` + bónus ${euro(funding.bonus)}` : ""}.</p>}

          <div className="category-table month-table">
            <div className="category-table-row category-table-header"><span>Objetivo</span><span>Planeado</span><span>Reservado</span></div>
            {plan.allocations.map((item) => (
              <div className="category-table-row" key={item.goalId}>
                <strong>{item.goalName}</strong>
                <span><input type="number" min="0" step="0.01" aria-label={`Planeado de ${item.goalName}`} disabled={plan.closed}
                  value={plannedDrafts[item.goalId] ?? item.planned}
                  onChange={(event) => { setPlannedDrafts((current) => ({ ...current, [item.goalId]: event.target.value })); setPreview(null); }} /></span>
                <span><input type="number" min="0" step="0.01" aria-label={`Reservado de ${item.goalName}`} disabled={plan.closed}
                  value={actualDrafts[item.goalId] ?? item.actual}
                  onChange={(event) => setActualDrafts((current) => ({ ...current, [item.goalId]: event.target.value }))}
                  onBlur={() => void saveActual(item.goalId)} /></span>
              </div>
            ))}
          </div>

          {!plan.closed && (
            <>
              <p className="form-note">
                Ajuste atual: {euro(editedTotal)} de {euro(plan.availableAmount)} ({euro(plannedDiff)} por distribuir).
                O ajuste muda apenas este mês; a confirmação recalcula os futuros meses abertos com a tabela aplicável.
              </p>
              {monthNote && <p className="form-note">{monthNote}</p>}
              <div className="editor-actions">
                <button className="secondary-button" onClick={() => void buildPreview()} disabled={previewBusy || !plannedDirty || plannedInvalid}>
                  {previewBusy ? "A pré-visualizar…" : "Pré-visualizar ajuste"}
                </button>
                <button className="save-button" onClick={() => void confirmAdjust()} disabled={busy || !preview || plannedInvalid || Math.abs(plannedDiff) > 0.005}>
                  {busy ? "A confirmar…" : "Confirmar ajustes"}
                </button>
                <button className="save-button" onClick={() => void closeMonth()} disabled={busy}>
                  {busy ? "A fechar…" : "Fechar mês"}
                </button>
              </div>
              {preview && preview.futureChanges.length > 0 && (
                <div className="category-table">
                  <div className="category-table-row category-table-header"><span>Mês futuro</span><span>Antes</span><span>Depois</span></div>
                  {preview.futureChanges.map((change) => (
                    <div key={change.month}>
                      <div className="category-table-row">
                        <strong>{displayMonth(change.month)}</strong>
                        <span>{euro(change.before.reduce((sum, entry) => sum + entry.planned, 0))}</span>
                        <span>{euro(change.after.reduce((sum, entry) => sum + entry.planned, 0))}</span>
                      </div>
                      {change.after.map((entry) => (
                        <div className="category-table-row" key={`${change.month}:${entry.goalId}`}>
                          <span>{goalName(entry.goalId)}</span>
                          <span>{euro(change.before.find((before) => before.goalId === entry.goalId)?.planned ?? 0)}</span>
                          <span>{euro(entry.planned)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              {preview && preview.missingMonths.length > 0 && (
                <p className="form-note">Sem tabela aplicável (não alterados): {preview.missingMonths.join(", ")}.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Painel A — template anual */}
      <section className="settings-section">
        <div className="section-title">
          <div><p className="eyebrow">Template anual</p><h2>Distribuição em percentagem</h2></div>
          <div className="entity-action-buttons">
            <label className="template-date">Aplicável a partir de <input type="month" value={templateDate} onChange={(event) => { if (MONTH_PATTERN.test(event.target.value)) setTemplateDate(event.target.value); }} /></label>
            <button className="secondary-button" onClick={openTemplateEditor} disabled={!goals.length}>Editar tabela</button>
          </div>
        </div>
        <p className="form-note">
          As percentagens têm de somar 100%. Guardar {existingTemplate ? "atualiza essa versão" : `cria uma nova versão a partir de ${templateDate}`} e pré-calcula o ano; meses fechados nunca mudam.
        </p>
        {templates.length > 0 && (
          <div className="category-table">
            <div className="category-table-row category-table-header"><span>Versão</span><span>Objetivos</span><span>Ação</span></div>
            {templates.map((template) => (
              <div className="category-table-row" key={template.id}>
                <strong>A partir de {template.validFrom}</strong>
                <span>{template.entries.map((entry) => `${goalName(entry.goalId)} ${entry.percentage}%`).join(" · ")}</span>
                <span><button className="secondary-button" onClick={() => setInspectedVersion((current) => (current === template.id ? null : template.id))}>
                  {inspectedVersion === template.id ? "Ocultar" : "Ver"}
                </button></span>
              </div>
            ))}
          </div>
        )}
        {inspectedVersion && (() => {
          const template = templates.find((item) => item.id === inspectedVersion);
          if (!template) return null;
          return (
            <div className="category-table">
              <div className="category-table-row category-table-header"><span>Objetivo</span><span>Percentagem</span></div>
              {template.entries.map((entry) => (
                <div className="category-table-row" key={entry.goalId}>
                  <strong>{goalName(entry.goalId)}</strong>
                  <span>{entry.percentage}%</span>
                </div>
              ))}
            </div>
          );
        })()}
        {templateEditing && (
          <>
            <div className="category-table">
              <div className="category-table-row">
                <strong>Total</strong>
                <span>{templatePct.toFixed(2)}% {templateValid ? "✓" : "(tem de dar 100%)"}</span>
              </div>
            </div>
            <div className="category-table">
              <div className="category-table-row category-table-header"><span>Objetivo</span><span>%</span></div>
              {templateRows.map((row) => (
                <div className="category-table-row" key={row.goalId}>
                  <strong>{goalName(row.goalId)}</strong>
                  <span><input aria-label={`Percentagem de ${goalName(row.goalId)}`} type="number" min="0" max="100" step="0.01"
                    value={row.percentage}
                    onChange={(event) => setTemplateRows((current) => current.map((item) => (item.goalId === row.goalId ? { ...item, percentage: Number(event.target.value) } : item)))} /></span>
                </div>
              ))}
            </div>
            {templateError && <p className="form-error" role="alert">{templateError}</p>}
            <div className="editor-actions">
              <button className="save-button" onClick={() => void saveTemplate()} disabled={templateSaving || !templateValid}>
                {templateSaving ? "A guardar…" : existingTemplate ? "Guardar versão (100%)" : "Criar versão (100%)"}
              </button>
              <button className="secondary-button" onClick={() => { setTemplateEditing(false); setTemplateRows([]); }}>Cancelar</button>
            </div>
          </>
        )}
      </section>

      {/* Painel B — gestão de objetivos */}
      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Objetivos</p><h2>Gestão de objetivos</h2></div><button className="secondary-button" onClick={openCreateGoal}>+ Novo objetivo</button></div>
        <p className="form-note">Desativar preserva o histórico; objetivos desativados saem das próximas tabelas.</p>
        {goals.length > 0 && (
          <div className="category-table">
            <div className="category-table-row category-table-header"><span>Objetivo</span><span>Ação</span></div>
            {goals.map((item) => (
              <div className="category-table-row" key={item.id}>
                <strong>{item.name}</strong>
                <div className="entity-action-buttons">
                  <button className="entity-edit-button" type="button" title={`Editar ${item.name}`} aria-label={`Editar ${item.name}`}
                    onClick={() => openRenameGoal(item)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                  </button>
                  <button className="entity-edit-button entity-remove-button" type="button" title={`Desativar ${item.name}`} aria-label={`Desativar ${item.name}`}
                    onClick={() => void deactivateGoal(item.id, item.name)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {goalModalOpen && <div className="entity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingGoal) setGoalModalOpen(false); }}>
        <section className="entity-modal" role="dialog" aria-modal="true" aria-labelledby="goal-modal-title">
          <div className="entity-modal-heading"><div><p className="eyebrow">Objetivos</p><h2 id="goal-modal-title">{editingGoalId ? "Editar objetivo" : "Novo objetivo"}</h2></div><button className="entity-modal-close" type="button" aria-label="Fechar" onClick={() => setGoalModalOpen(false)} disabled={savingGoal}>×</button></div>
          <form onSubmit={(event) => { event.preventDefault(); void saveGoal(); }}>
            <label className="entity-modal-field">Nome<input autoFocus required maxLength={100} value={goalFormName} onChange={(event) => setGoalFormName(event.target.value)} /></label>
            {goalFormError && <p className="form-error" role="alert">{goalFormError}</p>}
            <div className="entity-modal-actions"><button className="secondary-button" type="button" onClick={() => setGoalModalOpen(false)} disabled={savingGoal}>Cancelar</button><button className="save-button" type="submit" disabled={savingGoal}>{savingGoal ? "A guardar…" : "Guardar objetivo"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
