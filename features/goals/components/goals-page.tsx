"use client";

import { useEffect, useMemo, useState } from "react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { AppNav } from "@/shared/ui/app-nav";
import { formatEuro } from "@/shared/ui/money";
import { isValidTemplateTotal, totalPercentage } from "../domain/goal-template";
import type { GoalTemplateEntry } from "../domain/goal-template";
import type { Goal, GoalPriority, GoalTimeline, GoalYearReview } from "../domain/types";
import { goalYearTracking } from "../domain/goal-tracking";
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
  return formatEuro(value);
}

type FutureChange = {
  month: string;
  availableAmount: number;
  before: { goalId: string; planned: number }[];
  after: { goalId: string; planned: number }[];
};

type TemplatePreview = {
  validFrom: string;
  affected: FutureChange[];
  toCreate: string[];
  closedSkipped: string[];
  missingMonths: string[];
  invalidMonths: { month: string; reason: string }[];
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
  const [templatePreview, setTemplatePreview] = useState<TemplatePreview | null>(null);
  const [templatePreviewBusy, setTemplatePreviewBusy] = useState(false);
  const [inspectedVersion, setInspectedVersion] = useState<string | null>(null);

  // Painel B — gestão de objetivos (modal como nas categorias).
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "", priority: "NICE_TO_HAVE" as GoalPriority, timeline: "ANUAL" as GoalTimeline, realism: "OK", notes: "" });
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalFormError, setGoalFormError] = useState("");

  // Revisão anual: felicidade (1–5) e reflexão por objetivo e ano.
  const [reviews, setReviews] = useState<GoalYearReview[]>([]);
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({});

  // Nota do recálculo anual.
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
      const [{ plans, funding }, yearReviews] = await Promise.all([
        entitiesClient.getGoalYear(targetYear),
        entitiesClient.getGoalReviews(targetYear),
      ]);
      setYearPlans(plans);
      setYearFunding(funding);
      setReviews(yearReviews);
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
    setMonthNote("");
    setReflectionDrafts({});
    void reloadYear(year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const planByMonth = useMemo(() => new Map(yearPlans.map((item) => [item.month, item])), [yearPlans]);
  const fundingByMonth = useMemo(
    () => new Map((yearFunding?.months ?? []).map((item) => [item.month, item])),
    [yearFunding],
  );

  function goalName(goalId: string) {
    return goals.find((item) => item.id === goalId)?.name
      ?? yearPlans.flatMap((item) => item.allocations).find((item) => item.goalId === goalId)?.goalName
      ?? "Objetivo arquivado";
  }

  // ---- Painel A: template anual ----

  const existingTemplate = templates.find((item) => item.validFrom === templateDate) ?? null;
  const templatePct = totalPercentage(templateRows);
  const templateValid = templateRows.length > 0 && isValidTemplateTotal(templateRows);
  // Disponível anual de referência: preencher por % ou por valor dá o mesmo, um calcula o outro.
  const editorAnnualTotal = yearFunding?.annualTotal ?? 0;
  const templateAmountTotal = templatePct / 100 * editorAnnualTotal;

  function updateTemplateRowPercentage(goalId: string, percentage: number) {
    setTemplateRows((current) => current.map((item) => (item.goalId === goalId ? { ...item, percentage } : item)));
    setTemplatePreview(null);
  }

  function updateTemplateRowAmount(goalId: string, amount: number) {
    updateTemplateRowPercentage(goalId, editorAnnualTotal > 0 ? Math.round(amount / editorAnnualTotal * 10000) / 100 : 0);
  }

  function openTemplateEditor() {
    setTemplateError("");
    setTemplatePreview(null);
    const base = existingTemplate
      ?? templates.filter((item) => item.validFrom <= templateDate).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1)
      ?? null;
    const baseRows = new Map(base?.entries.map((entry) => [entry.goalId, entry]) ?? []);
    setTemplateRows(
      goals.map((item) => ({ goalId: item.id, percentage: baseRows.get(item.id)?.percentage ?? 0 })),
    );
    setTemplateEditing(true);
  }

  // Antevisão só de leitura: mostra os meses abertos afetados e os meses
  // fechados que ficam intactos. A gravação exige confirmação explícita.
  async function previewTemplate() {
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
    setTemplatePreviewBusy(true);
    try {
      const result = existingTemplate
        ? await entitiesClient.previewGoalTemplateUpdate(existingTemplate.id, { annualTotal, entries: templateRows })
        : await entitiesClient.previewGoalTemplate({ validFrom: templateDate, annualTotal, entries: templateRows });
      setTemplatePreview({ validFrom: result.validFrom, affected: result.affected as FutureChange[], toCreate: result.toCreate ?? [], closedSkipped: result.closedSkipped, missingMonths: result.missingMonths, invalidMonths: result.invalidMonths ?? [] });
    } catch (cause) {
      setTemplatePreview(null);
      setTemplateError(cause instanceof Error ? cause.message : "Não foi possível pré-visualizar a tabela.");
    } finally {
      setTemplatePreviewBusy(false);
    }
  }

  async function saveTemplate() {
    setTemplateError("");
    if (!templatePreview) {
      setTemplateError("Pré-visualiza a tabela antes de guardar.");
      return;
    }
    if (!window.confirm(
      existingTemplate
        ? `Guardar a versão com efeito a partir de ${templatePreview.validFrom} e recalcular os meses abertos afetados?`
        : `Criar uma nova versão com efeito a partir de ${templatePreview.validFrom} e pré-calcular o ano?`,
    )) return;
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
      setTemplatePreview(null);
      await reloadCatalog();
      await reloadYear(year);
    } catch (cause) {
      // Sem estado parcial enganador: se a gravação falhar, o editor
      // continua aberto com os valores para corrigir e tentar de novo.
      setTemplateError(cause instanceof Error ? cause.message : "Não foi possível guardar o template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  // ---- Painel B: gestão de objetivos ----

  function openCreateGoal() {
    setEditingGoalId(null);
    setGoalForm({ name: "", targetAmount: "", priority: "NICE_TO_HAVE", timeline: "ANUAL", realism: "OK", notes: "" });
    setGoalFormError("");
    setGoalModalOpen(true);
  }

  function openEditGoal(goal: Goal) {
    setEditingGoalId(goal.id);
    setGoalForm({
      name: goal.name,
      targetAmount: goal.targetAmount ? String(goal.targetAmount) : "",
      priority: goal.priority,
      timeline: goal.timeline,
      realism: goal.realism,
      notes: goal.notes,
    });
    setGoalFormError("");
    setGoalModalOpen(true);
  }

  async function saveGoal() {
    const trimmed = goalForm.name.trim();
    if (!trimmed) {
      setGoalFormError("Indica um nome para o objetivo.");
      return;
    }
    if (trimmed.length > 100) {
      setGoalFormError("Indica um nome até 100 caracteres.");
      return;
    }
    const targetAmount = goalForm.targetAmount.trim() === "" ? 0 : Number(goalForm.targetAmount);
    if (!Number.isFinite(targetAmount) || targetAmount < 0) {
      setGoalFormError("O orçamento tem de ser um número não negativo.");
      return;
    }
    if (goalForm.realism.length > 50) {
      setGoalFormError("O realismo tem de ter até 50 caracteres.");
      return;
    }
    if (goalForm.notes.length > 2000) {
      setGoalFormError("As notas têm de ter até 2000 caracteres.");
      return;
    }
    setGoalFormError("");
    setSavingGoal(true);
    try {
      const input = {
        name: trimmed,
        targetAmount: Math.round(targetAmount * 100) / 100,
        priority: goalForm.priority,
        timeline: goalForm.timeline,
        realism: goalForm.realism.trim(),
        notes: goalForm.notes.trim(),
      };
      if (editingGoalId) {
        await entitiesClient.updateGoal(editingGoalId, input);
      } else {
        await entitiesClient.createGoal(input);
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

  const reviewByGoal = useMemo(() => new Map(reviews.map((item) => [item.goalId, item])), [reviews]);

  async function saveReview(goalId: string, happiness: number | null, reflection: string) {
    if (reflection.length > 2000) {
      setError("A reflexão tem de ter até 2000 caracteres.");
      return;
    }
    setError("");
    try {
      const saved = await entitiesClient.saveGoalReview({ goalId, year, happiness, reflection });
      setReviews((current) => [...current.filter((item) => item.goalId !== goalId), saved]);
      setReflectionDrafts((current) => {
        const next = { ...current };
        delete next[goalId];
        return next;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a revisão.");
    }
  }

  async function recalculateYear() {
    setError("");
    setBusy(true);
    try {
      const result = await entitiesClient.recalcGoalYear(year);
      setYearPlans(result.plans);
      setYearFunding(result.funding);
      const invalid = result.invalidMonths ?? [];
      setMonthNote(
        invalid.length
          ? `Meses inválidos (objetivo inativo, não recalculados): ${invalid.map((item) => item.month).join(", ")}. Cria uma nova versão do template sem esse objetivo.`
          : result.missingMonths.length
            ? `Meses sem tabela aplicável (mantidos como estavam): ${result.missingMonths.join(", ")}.`
            : "Ano recalculado a partir do financiamento atual. Meses fechados intactos.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível recalcular o ano.");
    } finally {
      setBusy(false);
    }
  }

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

      {/* Visão anual (a revisão de cada mês faz-se na aba Mês) */}
      <section className="settings-section">
        <div className="section-title">
          <div><p className="eyebrow">Plano do ano {year}</p><h2>Visão anual</h2></div>
          <div className="entity-action-buttons">
            <button className="secondary-button" onClick={() => void recalculateYear()} disabled={busy || yearLoading}>
              {busy ? "A recalcular…" : "Recalcular ano"}
            </button>
          </div>
        </div>
        <p className="form-note">
          Disponível anual: {yearFunding ? euro(yearFunding.annualTotal) : "a calcular…"}.
          Cada mês distribui 100% do seu disponível. <strong>Por validar</strong> = mês ainda sem plano gravado.
          A revisão de cada mês faz-se na aba Mês.
        </p>
        {monthNote && <p className="form-note">{monthNote}</p>}
        {yearLoading ? (
          <p className="form-note">A carregar o ano…</p>
        ) : (
          <div className="category-table month-table">
            <div className="category-table-row category-table-header">
              <span>Mês</span><span>Estado</span><span className="num">Disponível</span><span className="num">Planeado</span><span className="num">Reservado</span>
            </div>
            {Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`).map((item) => {
              const itemPlan = planByMonth.get(item);
              const itemFunding = fundingByMonth.get(item);
              const status = itemPlan ? (itemPlan.closed ? "Fechado" : "Aberto") : "Por validar";
              const isCurrent = item === currentMonth();
              return (
                <div className="category-table-row" key={item}>
                  <strong>{shortMonth(item)}{isCurrent ? " •" : ""}</strong>
                  <span>{status}</span>
                  <span className="num">{itemFunding ? euro(itemFunding.available) : itemPlan ? euro(itemPlan.availableAmount) : "—"}</span>
                  <span className="num">{itemPlan ? euro(itemPlan.allocations.reduce((sum, entry) => sum + entry.planned, 0)) : "—"}</span>
                  <span className="num">{itemPlan ? euro(itemPlan.allocations.reduce((sum, entry) => sum + entry.actual, 0)) : "—"}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Acompanhamento anual por objetivo */}
      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Acompanhamento {year}</p><h2>Alvo, acumulado e risco</h2></div></div>
        <p className="form-note">O orçamento é só acompanhamento: não altera as percentagens. Em risco = o fim da timeline (T1 mar, T2 jun, T3 set, T4/ANUAL dez) já passou ou é este mês e o reservado fica abaixo do alvo.</p>
        {yearLoading ? (
          <p className="form-note">A carregar o ano…</p>
        ) : (
          <div className="category-table goal-tracking">
            <div className="category-table-row category-table-header"><span>Objetivo</span><span className="num">Alvo</span><span className="num">Planeado</span><span className="num">Reservado</span><span className="num">Falta</span><span>Estado</span></div>
            {goalYearTracking({ goals, plans: yearPlans, year, currentMonth: currentMonth() }).map((row) => (
              <div className="category-table-row" key={row.goalId}>
                <strong>{row.goalName}</strong>
                <span className="num">{euro(row.target)}</span>
                <span className="num">{euro(row.plannedTotal)}</span>
                <span className="num">{euro(row.actualTotal)}</span>
                <span className="num">{euro(row.missing)}</span>
                <span>{row.atRisk ? <span className="risk-flag">Em risco</span> : <span className="ok-flag">Em dia</span>}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Revisão anual: felicidade e reflexão */}
      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Revisão {year}</p><h2>Felicidade e reflexão</h2></div></div>
        <p className="form-note">A felicidade grava ao escolher; a reflexão grava ao sair do campo.</p>
        {yearLoading ? (
          <p className="form-note">A carregar o ano…</p>
        ) : (
          <div className="category-table goal-review">
            <div className="category-table-row category-table-header"><span>Objetivo</span><span>Felicidade</span><span>Reflexão / lição</span></div>
            {goals.map((goal) => {
              const review = reviewByGoal.get(goal.id);
              return (
                <div className="category-table-row" key={goal.id}>
                  <strong>{goal.name}</strong>
                  <span>
                    <select aria-label={`Felicidade de ${goal.name} em ${year}`} value={review?.happiness ?? ""} onChange={(event) => void saveReview(goal.id, event.target.value === "" ? null : Number(event.target.value), reflectionDrafts[goal.id] ?? review?.reflection ?? "")}>
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </span>
                  <span>
                    <input aria-label={`Reflexão de ${goal.name} em ${year}`} maxLength={2000} value={reflectionDrafts[goal.id] ?? review?.reflection ?? ""} onChange={(event) => setReflectionDrafts((current) => ({ ...current, [goal.id]: event.target.value }))} onBlur={(event) => void saveReview(goal.id, review?.happiness ?? null, event.target.value)} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Painel A — template anual */}
      <section className="settings-section">
        <div className="section-title">
          <div><p className="eyebrow">Template anual</p><h2>Distribuição em percentagem</h2></div>
          <div className="entity-action-buttons">
            <label className="template-date">Aplicável a partir de <input type="month" value={templateDate} onChange={(event) => { if (MONTH_PATTERN.test(event.target.value)) { setTemplateDate(event.target.value); setTemplatePreview(null); } }} /></label>
            <button className="secondary-button" onClick={openTemplateEditor} disabled={!goals.length}>Editar tabela</button>
          </div>
        </div>
        <p className="form-note">
          As percentagens têm de somar 100%. {existingTemplate
            ? "Esta data já tem uma versão: só pode ser editada se ainda não for usada por nenhum mês planeado — caso contrário, escolhe outro mês para criar uma nova versão."
            : `Guardar cria uma nova versão com efeito a partir de ${templateDate} e pré-calcula o ano; meses fechados nunca mudam.`} A gravação exige antevisão e confirmação.
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
            <p className="form-note">Preenche por percentagem ou por valor (do disponível anual de {euro(editorAnnualTotal)}): um calcula o outro. A soma tem de dar 100%.</p>
            <div className="category-table goal-template-editor">
              <div className="category-table-row">
                <strong>Total</strong>
                <span>{templatePct.toFixed(2)}% {templateValid ? "✓" : "(tem de dar 100%)"}</span>
                <span>{euro(Math.round(templateAmountTotal * 100) / 100)}</span>
              </div>
            </div>
            <div className="category-table goal-template-editor">
              <div className="category-table-row category-table-header"><span>Objetivo</span><span>%</span><span>Valor</span></div>
              {templateRows.map((row) => (
                <div className="category-table-row" key={row.goalId}>
                  <strong>{goalName(row.goalId)}</strong>
                  <span><input aria-label={`Percentagem de ${goalName(row.goalId)}`} type="number" min="0" max="100" step="0.01"
                    value={row.percentage}
                    onChange={(event) => updateTemplateRowPercentage(row.goalId, Number(event.target.value))} /></span>
                  <span><input aria-label={`Valor de ${goalName(row.goalId)}`} type="number" min="0" step="0.01"
                    value={Math.round(row.percentage / 100 * editorAnnualTotal * 100) / 100}
                    disabled={editorAnnualTotal <= 0}
                    title={editorAnnualTotal <= 0 ? "Sem disponível anual calculado" : `Valor do disponível anual (${euro(editorAnnualTotal)})`}
                    onChange={(event) => updateTemplateRowAmount(row.goalId, Number(event.target.value))} /></span>
                </div>
              ))}
            </div>
            {templateError && <p className="form-error" role="alert">{templateError}</p>}
            {templatePreview && (
              <>
                <p className="form-note">
                  Antevisão a partir de {templatePreview.validFrom}: {templatePreview.affected.length} mês(meses) abertos vão mudar.
                </p>
                {templatePreview.affected.length > 0 && (
                  <div className="category-table">
                    <div className="category-table-row category-table-header"><span>Mês</span><span className="num">Antes</span><span className="num">Depois</span></div>
                    {templatePreview.affected.map((change) => (
                      <div className="category-table-row" key={change.month}>
                        <strong>{displayMonth(change.month)}</strong>
                        <span className="num">{euro(change.before.reduce((sum, entry) => sum + entry.planned, 0))}</span>
                        <span className="num">{euro(change.after.reduce((sum, entry) => sum + entry.planned, 0))}</span>
                      </div>
                    ))}
                  </div>
                )}
                {templatePreview.closedSkipped.length > 0 && (
                  <p className="form-note">Fechados (não mudam): {templatePreview.closedSkipped.map(displayMonth).join(", ")}.</p>
                )}
                {templatePreview.toCreate.length > 0 && (
                  <p className="form-note">Meses a criar: {templatePreview.toCreate.map(displayMonth).join(", ")}.</p>
                )}
                {templatePreview.missingMonths.length > 0 && (
                  <p className="form-note">Sem tabela aplicável (não alterados): {templatePreview.missingMonths.join(", ")}.</p>
                )}
                {templatePreview.invalidMonths.length > 0 && (
                  <p className="form-error" role="alert">Meses inválidos (objetivo inativo, não gravados): {templatePreview.invalidMonths.map((item) => displayMonth(item.month)).join(", ")}.</p>
                )}
              </>
            )}
            <div className="editor-actions">
              <button className="secondary-button" onClick={() => void previewTemplate()} disabled={templatePreviewBusy || !templateValid}>
                {templatePreviewBusy ? "A pré-visualizar…" : "Pré-visualizar"}
              </button>
              <button className="save-button" onClick={() => void saveTemplate()} disabled={templateSaving || !templateValid || !templatePreview}>
                {templateSaving ? "A guardar…" : existingTemplate ? "Confirmar edição da versão" : "Confirmar nova versão"}
              </button>
              <button className="secondary-button" onClick={() => { setTemplateEditing(false); setTemplateRows([]); setTemplatePreview(null); }}>Cancelar</button>
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
                    onClick={() => openEditGoal(item)}>
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
            <label className="entity-modal-field">Nome<input autoFocus required maxLength={100} value={goalForm.name} onChange={(event) => setGoalForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <div className="person-modal-settings">
              <label className="entity-modal-field">Orçamento (€)<input type="number" min="0" step="0.01" value={goalForm.targetAmount} onChange={(event) => setGoalForm((current) => ({ ...current, targetAmount: event.target.value }))} /></label>
              <label className="entity-modal-field">Realismo<input maxLength={50} value={goalForm.realism} onChange={(event) => setGoalForm((current) => ({ ...current, realism: event.target.value }))} /></label>
            </div>
            <div className="person-modal-settings">
              <label className="entity-modal-field">Categoria<select value={goalForm.priority} onChange={(event) => setGoalForm((current) => ({ ...current, priority: event.target.value as GoalPriority }))}><option value="GRANDE">GRANDE</option><option value="PEQUENO">PEQUENO</option><option value="NICE_TO_HAVE">NICE TO HAVE</option></select></label>
              <label className="entity-modal-field">Timeline<select value={goalForm.timeline} onChange={(event) => setGoalForm((current) => ({ ...current, timeline: event.target.value as GoalTimeline }))}><option value="T1">T1</option><option value="T2">T2</option><option value="T3">T3</option><option value="T4">T4</option><option value="ANUAL">ANUAL</option></select></label>
            </div>
            <label className="entity-modal-field">Impacto / porquê<input maxLength={2000} value={goalForm.notes} onChange={(event) => setGoalForm((current) => ({ ...current, notes: event.target.value }))} /></label>
            {goalFormError && <p className="form-error" role="alert">{goalFormError}</p>}
            <div className="entity-modal-actions"><button className="secondary-button" type="button" onClick={() => setGoalModalOpen(false)} disabled={savingGoal}>Cancelar</button><button className="save-button" type="submit" disabled={savingGoal}>{savingGoal ? "A guardar…" : "Guardar objetivo"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
