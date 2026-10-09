import { NextResponse } from "next/server";
import { getPostgres } from "@/shared/lib/postgres";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID de mês inválido." }, { status: 400 });
    const result = await goalPlanRepository.close(id);
    if (result === "not_found") return NextResponse.json({ error: "Mês não encontrado." }, { status: 404 });
    // Fecho idempotente: repetir o fecho de um mês já fechado devolve o
    // mês sem alterar nada (sem erro), para retries seguros.
    const [row] = await getPostgres()<{ month: string }[]>`SELECT month FROM goal_plan_month WHERE id = ${id}`;
    return NextResponse.json(await goalPlanRepository.findByMonth(row.month));
  } catch (error) {
    console.error("Could not close goal month.", error);
    return NextResponse.json({ error: "Não foi possível fechar o mês." }, { status: 500 });
  }
}
