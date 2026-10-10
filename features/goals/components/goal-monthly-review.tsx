"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarPlus, Lock, Pencil, Target } from "lucide-react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { formatEuro } from "@/shared/ui/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerCard, LedgerNumberInput } from "@/components/app/ledger-card";
import type { GoalTemplate } from "../domain/goal-template";
import type { YearFunding } from "@/shared/lib/goal-funding";
import type { GoalPlanView } from "@/shared/repositories/goal-plan-repository";

function displayMonth(month: string) {
  return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}

function euro(value: number) {
  return formatEuro(value);
}

// Revisão mensal dos objetivos de um mês (planeado vs reservado).
// Vive na aba Mês; a aba Objetivos guarda a visão anual, o template e a gestão.
export function GoalMonthlyReview({ month }: { month: string }) {
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

  const year = Number(month.slice(0, 4));

  async function reloadCatalog() {
    const loadedTemplates = await entitiesClient.getGoalTemplates();
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
    <div className="flex flex-col gap-3">
      {error && <Alert variant="destructive">{error}</Alert>}

      {yearLoading && (
        <div className="flex flex-col gap-3" aria-label="A carregar os objetivos do mês">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-[125px]" />
            <Skeleton className="h-[125px]" />
            <Skeleton className="h-[125px]" />
          </div>
          <Skeleton className="h-[180px]" />
        </div>
      )}

      {!yearLoading && !plan && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-mint-soft text-primary-dark">
                <Target size={17} aria-hidden="true" />
              </span>
              <div className="flex flex-col gap-0.5">
                <p className="m-0 text-[10px] font-bold uppercase tracking-[1.5px] text-primary">Objetivos · mês</p>
                <CardTitle className="capitalize">{displayMonth(month)}</CardTitle>
              </div>
              <Badge variant="outline" className="ml-auto">Por validar</Badge>
            </div>
            <CardDescription>
              {funding
                ? `Disponível calculado: ${euro(funding.available)} (ordenado ${euro(funding.incomeNormal)} − contribuição ${euro(funding.contributionRequired)} − diário ${euro(funding.dailyAllowance)}${funding.bonus > 0 ? ` + bónus ${euro(funding.bonus)}` : ""}).`
                : "A calcular o disponível…"}
              {!templates.length ? " Cria primeiro a tabela anual na aba Objetivos." : ""}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-start">
            <Button onClick={() => void createMonth()} disabled={busy || !funding}>
              <CalendarPlus size={14} data-icon="inline-start" aria-hidden="true" />
              {busy ? "A criar…" : "Criar mês"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {!yearLoading && plan && (
        <LedgerCard
          icon={
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-mint-soft text-primary-dark">
              <Target size={17} aria-hidden="true" />
            </span>
          }
          eyebrow="Objetivos · revisão mensal"
          closed={plan.closed}
          totalsAriaLabel="Totais dos objetivos do mês"
          plannedTotal={totalPlanned}
          actualTotal={totalActual}
          tone="save"
          entityLabel="Objetivo"
          rows={plan.allocations.map((item) => {
            const raw = actualDrafts[item.goalId];
            const parsed = raw === undefined ? item.actual : Number(raw);
            return {
              id: item.goalId,
              name: item.goalName,
              planned: item.planned,
              actual: Number.isFinite(parsed) ? parsed : item.actual,
            };
          })}
          renderPlanned={(row) => {
            const editing = editingPlannedIds[row.id];
            const label = row.name;
            return (
              <span className="flex items-center justify-end gap-1">
                {editing ? (
                  <LedgerNumberInput
                    aria-label={`Planeado de ${label}`}
                    disabled={plan.closed}
                    value={plannedDrafts[row.id] ?? row.planned}
                    onChange={(event) => setPlannedDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
                  />
                ) : (
                  <span className="tabular-nums text-muted">{euro(row.planned)}</span>
                )}
                {!plan.closed && (
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    title={editing ? `Fechar edição de ${label}` : `Editar planeado de ${label} (só exceções)`}
                    aria-label={editing ? `Fechar edição de ${label}` : `Editar planeado de ${label}`}
                    onClick={() => togglePlannedEdit(row.id)}
                    className="size-7 shrink-0"
                  >
                    <Pencil size={13} aria-hidden="true" />
                  </Button>
                )}
              </span>
            );
          }}
          renderActual={(row) => (
            <LedgerNumberInput
              aria-label={`Valor real de ${row.name}`}
              disabled={plan.closed}
              value={actualDrafts[row.id] ?? plan.allocations.find((item) => item.goalId === row.id)?.actual ?? 0}
              onChange={(event) => setActualDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
              onBlur={() => void saveActual(row.id)}
            />
          )}
          footer={
            !plan.closed ? (
              <Button onClick={() => void saveAndClose()} disabled={busy}>
                <Lock size={14} data-icon="inline-start" aria-hidden="true" />
                {busy ? "A fechar…" : "Fechar mês"}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
