"use client";

import { useEffect, useMemo, useState } from "react";
import { entitiesClient } from "@/shared/lib/entities-client";
import type { GoalTemplate } from "../domain/goal-template";
import type { Goal } from "../domain/types";
import type { YearFunding } from "@/shared/lib/goal-funding";
import type { GoalPlanView } from "@/shared/repositories/goal-plan-repository";

function displayMonth(month: string) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function euro(value: number) {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);
}

// Revisão mensal dos objetivos de um mês (planeado vs reservado).
// Vive na aba Mês; a aba Objetivos guarda a visão anual, o template e a gestão.
export function GoalMonthlyReview({ month }: { month: string }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [yearPlans, setYearPlans] = useState<GoalPlanView[]>([]);
  const [yearFunding, setYearFunding] = useState<YearFunding | null>(null);
  const [yearLoading, setYearLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [plannedDrafts, setPlannedDrafts] = useState<Record<string, string>>({});
  const [actualDrafts, setActualDrafts] = useState<Record<string, string>>({});
  // Planeado é só-leitura por omissão; o lápis abre a edição de uma linha.
  const [editingPlannedIds, setEditingPlannedIds] = useState<Record<string, boolean>>({});
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
    setPlannedDrafts({});
    setActualDrafts({});
    setEditingPlannedIds({});
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

  const storedPlanned = useMemo(() => new Map((plan?.allocations ?? []).map((item) => [item.goalId, item.planned])), [plan]);
  const editedPlanned = useMemo(
    () => (plan?.allocations ?? []).map((item) => ({
      goalId: item.goalId,
      planned: plannedDrafts[item.goalId] === undefined ? item.planned : Number(plannedDrafts[item.goalId]),
    })),
    [plan, plannedDrafts],
  );
  const plannedDirty = editedPlanned.some((item) => Math.abs(item.planned - (storedPlanned.get(item.goalId) ?? 0)) > 0.005);
  const plannedInvalid = editedPlanned.some((item) => !Number.isFinite(item.planned) || item.planned < 0);

  // Reservado vem pré-preenchido com o planeado (é o valor que fica em quase
  // todos os meses): só meses abertos e só linhas ainda sem reservado.
  // Mudar de mês recomeça do zero para não arrastar rascunhos entre meses.
  useEffect(() => {
    setPlannedDrafts({});
    setEditingPlannedIds({});
    if (!plan || plan.closed) {
      setActualDrafts({});
      return;
    }
    setActualDrafts(Object.fromEntries(
      plan.allocations
        .filter((item) => item.actual === 0)
        .map((item) => [item.goalId, item.planned.toFixed(2)]),
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan?.id]);

  function togglePlannedEdit(goalId: string) {
    const editing = !editingPlannedIds[goalId];
    setEditingPlannedIds((current) => ({ ...current, [goalId]: editing }));
    setPlannedDrafts((current) => {
      const next = { ...current };
      if (editing) {
        if (next[goalId] === undefined) next[goalId] = String(storedPlanned.get(goalId) ?? 0);
      } else {
        delete next[goalId];
      }
      return next;
    });
  }

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

  // Um só botão: grava reservados pendentes, grava o planeado e fecha o mês.
  // Planeado intocado e a zeros é preenchido pela tabela; o fecho também
  // recalcula os futuros meses abertos com a tabela aplicável.
  async function saveAndClose() {
    if (!plan || plan.closed) return;
    if (!window.confirm(`Guardar e fechar ${displayMonth(month)}? O planeado e o reservado ficam imutáveis.`)) return;
    setError("");
    setMonthNote("");
    for (const [goalId, raw] of Object.entries(actualDrafts)) {
      const value = Number(raw);
      if (raw.trim() === "" || !Number.isFinite(value) || value < 0) {
        setError("Os valores reservados devem ser números não negativos.");
        return;
      }
    }
    if (plannedInvalid) {
      setError("Os valores planeados devem ser números não negativos.");
      return;
    }
    setBusy(true);
    try {
      for (const [goalId, raw] of Object.entries(actualDrafts)) {
        await entitiesClient.updateGoalAllocation(plan.id, goalId, { actual: Number(raw) });
      }
      setActualDrafts({});
      const missing = plan.availableAmount - editedPlanned.reduce((sum, item) => sum + item.planned, 0);
      if (Math.abs(missing) > 0.005) {
        // Sem edições manuais, a distribuição pela tabela é calculada e gravada no servidor.
        if (Object.keys(plannedDrafts).length > 0) {
          throw new Error(`Falta distribuir ${euro(missing)}. Ajusta o planeado (lápis) antes de fechar.`);
        }
        await entitiesClient.applyGoalAdjustFromTemplate(month);
      } else if (plannedDirty) {
        await entitiesClient.applyGoalAdjust(month, editedPlanned);
      }
      await entitiesClient.closeGoalPlan(plan.id);
      setPlannedDrafts({});
      setEditingPlannedIds({});
      await reloadYear(year);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar e fechar o mês.");
    } finally {
      setBusy(false);
    }
  }

  const totalPlanned = plan?.allocations.reduce((sum, item) => sum + item.planned, 0) ?? 0;
  const totalActual = plan?.allocations.reduce((sum, item) => sum + item.actual, 0) ?? 0;

  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}

      {!yearLoading && !plan && (
        <section className="settings-section">
          <div className="section-title"><div><p className="eyebrow">Objetivos · mês</p><h2>{displayMonth(month)}</h2></div></div>
          <p className="form-note">
            {funding
              ? `Disponível calculado: ${euro(funding.available)} (ordenado ${euro(funding.incomeNormal)} − contribuição ${euro(funding.contributionRequired)} − fixos individuais ${euro(funding.individualFixedTotal)} − diário ${euro(funding.dailyAllowance)}${funding.bonus > 0 ? ` + bónus ${euro(funding.bonus)}` : ""}).`
              : "A calcular o disponível…"}
            {!templates.length ? " Cria primeiro a tabela anual na aba Objetivos." : ""}
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
            <div><p className="eyebrow">Objetivos · revisão mensal</p><h2>{displayMonth(month)} {plan.closed ? "(Fechado)" : "(Aberto)"}</h2></div>
          </div>
          {plan.closed && <p className="form-note">Mês fechado — planeado e reservado são apenas leitura e nunca mudam.</p>}
          <section className="category-totals">
            <article className="panel"><p className="eyebrow">Disponível</p><h2>{euro(plan.availableAmount)}</h2></article>
            <article className="panel"><p className="eyebrow">Planeado</p><h2>{euro(totalPlanned)}</h2></article>
            <article className="panel"><p className="eyebrow">Reservado</p><h2>{euro(totalActual)}</h2></article>
            <article className="panel"><p className="eyebrow">Diferença</p><h2>{euro(plan.availableAmount - totalPlanned)}</h2></article>
          </section>
          {funding && <p className="form-note">Cálculo: ordenado {euro(funding.incomeNormal)} − contribuição {euro(funding.contributionRequired)} − fixos individuais {euro(funding.individualFixedTotal)} − diário {euro(funding.dailyAllowance)}{funding.bonus > 0 ? ` + bónus ${euro(funding.bonus)}` : ""}.</p>}

          <div className="category-table month-table">
            <div className="category-table-row category-table-header"><span>Objetivo</span><span>Planeado</span><span>Reservado</span></div>
            {plan.allocations.map((item) => (
              <div className="category-table-row" key={item.goalId}>
                <strong>{item.goalName}</strong>
                <span>
                  {editingPlannedIds[item.goalId]
                    ? <input type="number" min="0" step="0.01" aria-label={`Planeado de ${item.goalName}`} disabled={plan.closed}
                      value={plannedDrafts[item.goalId] ?? item.planned}
                      onChange={(event) => setPlannedDrafts((current) => ({ ...current, [item.goalId]: event.target.value }))} />
                    : <>{euro(item.planned)} </>}
                  {!plan.closed && <button className="entity-edit-button" type="button"
                    title={editingPlannedIds[item.goalId] ? `Fechar edição de ${item.goalName}` : `Editar planeado de ${item.goalName} (só exceções)`}
                    aria-label={editingPlannedIds[item.goalId] ? `Fechar edição de ${item.goalName}` : `Editar planeado de ${item.goalName}`}
                    onClick={() => togglePlannedEdit(item.goalId)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                  </button>}
                </span>
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
                O reservado vem pré-preenchido com o planeado; o planeado edita-se pelo lápis (só exceções).
                Guardar distribui meses frescos pela tabela anual e recalcula os futuros meses abertos.
              </p>
              {monthNote && <p className="form-note">{monthNote}</p>}
              <div className="editor-actions">
                <button className="save-button" onClick={() => void saveAndClose()} disabled={busy}>
                  {busy ? "A guardar…" : "Guardar e fechar mês"}
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {yearLoading && <p className="form-note">A carregar os objetivos do mês…</p>}
    </>
  );
}
