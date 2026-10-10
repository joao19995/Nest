"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, HandCoins, Lock, Receipt } from "lucide-react";
import { entitiesClient } from "@/shared/lib/entities-client";
import { emptyFinanceState, loadFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { formatEuro } from "@/shared/ui/money";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { LedgerCard, LedgerNumberInput } from "@/components/app/ledger-card";
import { MonthControls } from "@/components/app/month-controls";
import { GoalMonthlyReview } from "@/features/goals/components/goal-monthly-review";
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
  const label = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function euro(value: number) {
  return formatEuro(value);
}

export function MonthlyPlanPage() {
  const [state, setState] = useState<FinanceState>(emptyFinanceState);
  const [month, setMonth] = useState(currentMonth());
  const [plan, setPlan] = useState<MonthlyPlanView | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "ready">("loading");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadFinanceState().then(setState).catch(showFinanceStorageError);
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
      setError("O valor real deve ser um número não negativo.");
      return;
    }
    if (value === entry.actual) return;
    setError("");
    try {
      setPlan(await entitiesClient.updateMonthlyPlanActual(plan.id, entry.id, value));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar o valor real.");
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

  function personName(personId: string) {
    return state.configuration.people.find((person) => person.id === personId)?.name ?? "—";
  }

  return (
    <main className="mx-auto w-full max-w-[960px] px-4 pb-14 sm:px-8">
      <AppNav active="month" />

      <div className="flex flex-col gap-4 pb-6 pt-8">
        <p className="m-0 text-[10px] font-bold uppercase tracking-[1.5px] text-primary">
          Execução mensal
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="m-0 font-display text-[28px] font-extrabold tracking-[-0.8px] text-ink sm:text-[32px]">
            {displayMonth(month)}
          </h1>
          <span className="ml-auto flex">
            <MonthControls
              currentLabel={displayMonth(month)}
              onPrev={() => setMonth((current) => shiftMonth(current, -1))}
              onNext={() => setMonth((current) => shiftMonth(current, 1))}
              prevLabel="Mês anterior"
              nextLabel="Mês seguinte"
            />
          </span>
        </div>
      </div>

      {error && <Alert variant="destructive" className="mb-3">{error}</Alert>}

      {status === "loading" && (
        <div className="flex flex-col gap-3" aria-label="A carregar o mês">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-[125px]" />
            <Skeleton className="h-[125px]" />
            <Skeleton className="h-[125px]" />
          </div>
          <Skeleton className="h-[220px]" />
        </div>
      )}

      {status === "missing" && (
        <Card>
          <CardHeader>
            <span className="grid size-10 place-items-center rounded-[10px] bg-mint-soft text-primary-dark">
              <CalendarPlus size={18} aria-hidden="true" />
            </span>
            <CardTitle className="mt-2">Este mês ainda não foi criado</CardTitle>
            <CardDescription>
              Ao criar, copia-se o template aplicável a {displayMonth(month)}. O planeado fica logo fixo.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-start">
            <Button onClick={() => void createPlan()} disabled={busy}>
              {busy ? "A criar…" : "Criar mês"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {status === "ready" && plan && (
        <div className="flex flex-col gap-3">
          <LedgerCard
            icon={
              <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-mint-soft text-primary-dark">
                <Receipt size={17} aria-hidden="true" />
              </span>
            }
            eyebrow="Despesas"
            closed={plan.closed}
            totalsAriaLabel="Totais do mês"
            plannedTotal={planned}
            actualTotal={actual}
            statNotes={["Snapshot do template.", "Valores reais introduzidos.", "Real − planeado."]}
            entityLabel="Categoria"
            rows={entries.map((entry) => ({
              id: entry.id,
              name: entry.categoryName,
              sub: entry.accountName,
              planned: entry.planned,
              actual: displayedActual(entry),
            }))}
            renderActual={(row) => {
              const entry = entries.find((item) => item.id === row.id);
              if (!entry) return null;
              return (
                <LedgerNumberInput
                  aria-label={`Valor real de ${entry.categoryName}`}
                  disabled={plan.closed}
                  value={drafts[entry.id] ?? entry.actual}
                  onChange={(event) => setDrafts((current) => ({ ...current, [entry.id]: event.target.value }))}
                  onBlur={() => void saveActual(entry)}
                />
              );
            }}
            emptyMessage="Este mês não tem categorias. Verifica o template aplicável."
            footer={
              !plan.closed ? (
                <Button onClick={() => void closePlan()} disabled={busy}>
                  <Lock size={14} data-icon="inline-start" aria-hidden="true" />
                  {busy ? "A fechar…" : "Fechar mês"}
                </Button>
              ) : undefined
            }
          />

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-terra-soft text-terra-dark">
                  <HandCoins size={17} aria-hidden="true" />
                </span>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[1.5px] text-primary">Contribuições</p>
              </div>
            </CardHeader>
            <CardContent>
              {contributions?.status === "no-income" && (
                <Alert variant="destructive">{contributions.message}</Alert>
              )}
              {contributions?.status === "ok" && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {contributions.people.map((item) => {
                      const name = personName(item.personId);
                      const result = item.transferToJoint > 0.005
                        ? { label: `Transferir ${euro(item.transferToJoint)}`, variant: "open" as const }
                        : item.transferToPerson > 0.005
                          ? { label: `Receber ${euro(item.transferToPerson)}`, variant: "closed" as const }
                          : { label: "Certo", variant: "muted" as const };
                      return (
                        <li
                          key={item.personId}
                          className="flex flex-wrap items-center gap-3 rounded-[10px] border border-solid border-line-soft bg-paper px-3 py-2.5"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-terra-soft text-[13px] font-bold text-terra-dark" aria-hidden="true">
                            {name.charAt(0).toUpperCase()}
                          </span>
                          <span className="flex min-w-[140px] flex-1 flex-col gap-0.5">
                            <strong className="text-[13px] text-ink">{name}</strong>
                            <span className="text-[11px] text-muted">
                              Quota {euro(item.quota)} · já pago {euro(item.personalActual)}
                            </span>
                          </span>
                          <Badge variant={result.variant}>{result.label}</Badge>
                        </li>
                      );
                    })}
                  </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Separator className="mb-6 mt-8" />

      <GoalMonthlyReview month={month} />
    </main>
  );
}
