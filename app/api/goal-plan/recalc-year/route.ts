import { NextResponse } from "next/server";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { goalTemplateRepository } from "@/shared/repositories/goal-template-repository";
import { getYearFunding } from "@/shared/lib/goal-funding";
import { buildYearSeeds } from "@/shared/lib/goal-year-planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Recalcula o ano a partir do financiamento atual: cria meses em falta e
 * atualiza os meses abertos com o template aplicável. Meses fechados nunca
 * são alterados. Meses sem template aplicável são reportados, não inventados.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { year?: unknown };
    if (typeof body.year !== "number" || !Number.isInteger(body.year) || body.year < 2000 || body.year > 2100) {
      return NextResponse.json({ error: "Indica um ano válido (YYYY)." }, { status: 400 });
    }
    const [funding, templates] = await Promise.all([
      getYearFunding(body.year),
      goalTemplateRepository.findAll(),
    ]);
    const { seeds, missingMonths } = buildYearSeeds({
      year: body.year,
      funding: funding.months.map((item) => ({ month: item.month, available: item.available })),
      templates,
    });
    if (seeds.length) await goalPlanRepository.ensureYearPlansAtomic(body.year, seeds);
    const plans = await goalPlanRepository.listByYear(body.year);
    return NextResponse.json({ plans, funding, missingMonths });
  } catch (error) {
    console.error("Could not recalculate goal year.", error);
    return NextResponse.json({ error: "Não foi possível recalcular o ano." }, { status: 500 });
  }
}
