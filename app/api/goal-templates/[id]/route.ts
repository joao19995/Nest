import { NextResponse } from "next/server";
import { parseGoalTemplateEntries } from "@/app/api/goal-templates/route";
import { goalTemplateRepository, GoalTemplateVersionError } from "@/shared/repositories/goal-template-repository";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { goalRepository } from "@/shared/repositories/goal-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { buildYearSeeds, previewTemplateChange } from "@/shared/lib/goal-year-planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Editar uma versão SÓ é permitido quando ainda não governa nenhum mês
 * planeado (versão futura não usada). Versões usadas são imutáveis: uma
 * tentativa de edição devolve 409 a pedir uma nova versão com efeito a
 * partir do mês pretendido — nunca reescreve o significado histórico.
 * Com dryRun=true devolve a antevisão sem escrever nada; sem dryRun grava
 * a edição e o pré-cálculo do ano na mesma transação.
 */
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const body = (await request.json()) as { annualTotal?: unknown; entries?: unknown; dryRun?: unknown };
    if (typeof body.annualTotal !== "number" || !Number.isFinite(body.annualTotal) || body.annualTotal < 0) {
      return NextResponse.json({ error: "O valor anual deve ser um número não negativo." }, { status: 400 });
    }
    const parsed = parseGoalTemplateEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const existing = await goalTemplateRepository.findById(id);
    if (!existing) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });

    const active = await goalRepository.list();
    const activeIds = new Set(active.map((goal) => goal.id));
    if (parsed.entries.some((entry) => !activeIds.has(entry.goalId))) {
      return NextResponse.json(
        { error: "A tabela refere um objetivo inexistente ou desativado. Reativa o objetivo ou remove-o da tabela." },
        { status: 400 },
      );
    }

    // Versões usadas por meses planeados são imutáveis — verificação no
    // servidor (não só na UI), antes de qualquer escrita.
    const governed = await goalTemplateRepository.findGovernedMonths(id);
    if (governed.length) {
      const closed = governed.filter((item) => item.closed).map((item) => item.month);
      return NextResponse.json(
        {
          error:
            "Esta versão já é usada por meses planeados e não pode ser alterada. Cria uma nova versão com efeito a partir do mês pretendido.",
          governedMonths: governed.map((item) => item.month),
          closedMonths: closed,
        },
        { status: 409 },
      );
    }

    const year = Number(existing.validFrom.slice(0, 4));
    const [funding, templates, yearPlans] = await Promise.all([
      getYearFunding(year),
      goalTemplateRepository.findAll(),
      goalPlanRepository.listByYear(year),
    ]);
    const storedPlans = yearPlans.map((item) => ({
      planId: item.id,
      month: item.month,
      availableAmount: item.availableAmount,
      closed: item.closed,
      allocations: item.allocations.map((entry) => ({ goalId: entry.goalId, planned: entry.planned })),
    }));

    if (body.dryRun === true) {
      const preview = previewTemplateChange({
        validFrom: existing.validFrom,
        proposedEntries: parsed.entries,
        storedPlans,
        fundingByMonth: new Map(funding.months.map((item) => [item.month, item.available])),
        templates,
        replacedId: id,
        proposedId: id,
      });
      return NextResponse.json({ preview: true as const, validFrom: existing.validFrom, editable: true as const, ...preview });
    }

    try {
      const effective = templates.map((template) => (template.id === id ? { ...template, entries: parsed.entries } : template));
      const { seeds } = buildYearSeeds({
        year,
        funding: funding.months.map((item) => ({ month: item.month, available: item.available })),
        templates: effective,
      });
      const updated = await goalTemplateRepository.replaceUnusedWithYearSeeds(
        id,
        body.annualTotal as number,
        parsed.entries,
        year,
        seeds,
      );
      if (!updated) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
      const plans = await goalPlanRepository.listByYear(year);
      return NextResponse.json({ preview: false as const, template: updated, plans });
    } catch (error) {
      if (error instanceof GoalTemplateVersionError) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error("Could not update goal template.", error);
    return NextResponse.json({ error: "Não foi possível atualizar o template." }, { status: 500 });
  }
}
