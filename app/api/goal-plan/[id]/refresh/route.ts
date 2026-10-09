import { NextResponse } from "next/server";
import { getPostgres } from "@/shared/lib/postgres";
import { isUuid } from "@/shared/lib/uuid";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";
import { getMonthFunding } from "@/shared/lib/goal-funding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Recalcula o disponível a partir dos rendimentos e despesas atuais (só em meses abertos).
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID de mês inválido." }, { status: 400 });
    const [row] = await getPostgres()<{ month: string }[]>`SELECT month FROM goal_plan_month WHERE id = ${id}`;
    if (!row) return NextResponse.json({ error: "Mês não encontrado." }, { status: 404 });
    const funding = await getMonthFunding(row.month);
    const result = await goalPlanRepository.refreshAvailable(id, funding.available);
    if (result === "closed") return NextResponse.json({ error: "Mês fechado — apenas leitura." }, { status: 409 });
    return NextResponse.json(await goalPlanRepository.findByMonth(row.month));
  } catch (error) {
    console.error("Could not refresh goal month.", error);
    return NextResponse.json({ error: "Não foi possível recalcular o mês." }, { status: 500 });
  }
}
