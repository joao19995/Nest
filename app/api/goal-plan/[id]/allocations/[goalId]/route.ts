import { NextResponse } from "next/server";
import { getPostgres } from "@/shared/lib/postgres";
import { isUuid } from "@/shared/lib/uuid";
import { goalPlanRepository } from "@/shared/repositories/goal-plan-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; goalId: string }> }) {
  try {
    const { id, goalId } = await context.params;
    if (!isUuid(id) || !isUuid(goalId)) return NextResponse.json({ error: "IDs inválidos." }, { status: 400 });
    const body = (await request.json()) as { actual?: unknown };
    if (typeof body.actual !== "number" || !Number.isFinite(body.actual) || body.actual < 0) {
      return NextResponse.json({ error: "O valor actual deve ser um número não negativo." }, { status: 400 });
    }
    const result = await goalPlanRepository.updateAllocation(id, goalId, { actual: body.actual });
    if (result === "not_found") return NextResponse.json({ error: "Mês ou objetivo não encontrado." }, { status: 404 });
    if (result === "closed") return NextResponse.json({ error: "Mês fechado — apenas leitura." }, { status: 409 });
    const [row] = await getPostgres()<{ month: string }[]>`SELECT month FROM goal_plan_month WHERE id = ${id}`;
    return NextResponse.json(await goalPlanRepository.findByMonth(row.month));
  } catch (error) {
    console.error("Could not update goal allocation.", error);
    return NextResponse.json({ error: "Não foi possível guardar a alocação." }, { status: 500 });
  }
}
