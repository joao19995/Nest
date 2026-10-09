import { NextResponse } from "next/server";
import { parseGoalTemplateEntries } from "@/app/api/goal-templates/route";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { buildYearSeeds } from "@/shared/lib/goal-year-planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const body = (await request.json()) as { annualTotal?: unknown; entries?: unknown };
    if (typeof body.annualTotal !== "number" || !Number.isFinite(body.annualTotal) || body.annualTotal < 0) {
      return NextResponse.json({ error: "O valor anual deve ser um número não negativo." }, { status: 400 });
    }
    const parsed = parseGoalTemplateEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const updated = await goalTemplateRepository.replace(id, body.annualTotal, parsed.entries);
    if (!updated) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    // Recalcula o ano da versão alterada; meses fechados nunca são tocados.
    const funding = await getYearFunding(Number(updated.validFrom.slice(0, 4)));
    const templates = await goalTemplateRepository.findAll();
    const { seeds } = buildYearSeeds({
      year: Number(updated.validFrom.slice(0, 4)),
      funding: funding.months.map((item) => ({ month: item.month, available: item.available })),
      templates,
    });
    if (seeds.length) await goalPlanRepository.ensureYearPlansAtomic(Number(updated.validFrom.slice(0, 4)), seeds);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Could not update goal template.", error);
    return NextResponse.json({ error: "Não foi possível atualizar o template." }, { status: 500 });
  }
}
