import { NextResponse } from "next/server";
import { isValidMonth } from "@/shared/lib/category-template-validation";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { computeAdjustRecalc } from "@/shared/lib/goal-year-planner";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdjustInput = { goalId: string; planned: number };

function parseBody(body: { month?: unknown; allocations?: unknown }): { month: string; allocations: AdjustInput[] } | { error: string } {
  if (!isValidMonth(body.month)) return { error: "Indica um mês válido (YYYY-MM)." };
  if (!Array.isArray(body.allocations) || !body.allocations.length) return { error: "Indica as alocações do mês." };
  const seen = new Set<string>();
  const allocations: AdjustInput[] = [];
  for (const item of body.allocations as { goalId?: unknown; planned?: unknown }[]) {
    if (typeof item?.goalId !== "string" || !isUuid(item.goalId)) return { error: "ID de objetivo inválido." };
    if (typeof item?.planned !== "number" || !Number.isFinite(item.planned) || item.planned < 0) {
      return { error: "Os valores devem ser números não negativos." };
    }
    if (seen.has(item.goalId)) return { error: "O mesmo objetivo não pode aparecer duas vezes." };
    seen.add(item.goalId);
    allocations.push({ goalId: item.goalId, planned: Math.round(item.planned * 100) / 100 });
  }
  return { month: body.month, allocations };
}

/**
 * Ajuste manual de um mês aberto. Com dryRun=true devolve a antevisão das
 * alterações (mês + futuros meses abertos) sem gravar nada. Com
 * dryRun=false (confirmação explícita) grava tudo numa única transação:
 * ou todos os meses são atualizados ou nenhum é.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { month?: unknown; allocations?: unknown; dryRun?: unknown };
    const parsed = parseBody(body);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { month, allocations } = parsed;
    const dryRun = body.dryRun === true;

    const plan = await goalPlanRepository.findByMonth(month);
    if (!plan) return NextResponse.json({ error: "Este mês ainda não foi criado." }, { status: 404 });
    if (plan.closed) return NextResponse.json({ error: "Mês fechado — apenas leitura." }, { status: 409 });

    const totalCents = Math.round(allocations.reduce((sum, item) => sum + item.planned, 0) * 100);
    const availableCents = Math.round(plan.availableAmount * 100);
    if (totalCents !== availableCents) {
      const diff = (plan.availableAmount - totalCents / 100).toFixed(2);
      return NextResponse.json(
        { error: `A soma das alocações tem de igualar o disponível (${diff} € por distribuir).` },
        { status: 400 },
      );
    }

    const year = Number(month.slice(0, 4));
    const [funding, templates, yearPlans] = await Promise.all([
      getYearFunding(year),
      goalTemplateRepository.findAll(),
      goalPlanRepository.listByYear(year),
    ]);

    // O mês ajustado fica exatamente como o utilizador definiu; os futuros
    // meses abertos são recalculados com o template aplicável a cada mês.
    const { toApply, futureChanges, missingMonths } = computeAdjustRecalc({
      targetMonth: month,
      targetAvailable: plan.availableAmount,
      targetAllocations: allocations,
      storedPlans: yearPlans.map((item) => ({
        planId: item.id,
        month: item.month,
        availableAmount: item.availableAmount,
        closed: item.closed,
        allocations: item.allocations.map((entry) => ({ goalId: entry.goalId, planned: entry.planned })),
      })),
      fundingByMonth: new Map(funding.months.map((item) => [item.month, item.available])),
      templates,
    });

    if (dryRun) {
      return NextResponse.json({
        preview: true as const,
        month,
        availableAmount: plan.availableAmount,
        newAllocations: allocations,
        futureChanges,
        missingMonths,
      });
    }

    try {
      await goalPlanRepository.applyMonthsAtomic(toApply);
    } catch (cause) {
      if (cause && typeof cause === "object" && "code" in cause) {
        const code = (cause as { code: string }).code;
        if (code === "closed") return NextResponse.json({ error: "Um dos meses foi fechado entretanto. Recarrega e tenta de novo." }, { status: 409 });
        return NextResponse.json({ error: "Mês não encontrado." }, { status: 404 });
      }
      throw cause;
    }
    const plans = await goalPlanRepository.listByYear(year);
    return NextResponse.json({ preview: false as const, plans, futureChanges, missingMonths });
  } catch (error) {
    console.error("Could not adjust goal month.", error);
    return NextResponse.json({ error: "Não foi possível ajustar o mês." }, { status: 500 });
  }
}
