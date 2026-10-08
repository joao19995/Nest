import { NextResponse } from "next/server";
import { monthlyPlanRepository } from "@/shared/repositories/monthly-plan-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Só o actual é editável. O planeado é um snapshot do template e nunca muda depois de criado o mês.
export async function PATCH(request: Request, context: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    const { id, entryId } = await context.params;
    if (!isUuid(id) || !isUuid(entryId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const body = await request.json() as Record<string, unknown>;
    if ("planned" in body) return NextResponse.json({ error: "O valor planeado é imutável e vem do template." }, { status: 400 });
    if (typeof body.actual !== "number" || !Number.isFinite(body.actual) || body.actual < 0) {
      return NextResponse.json({ error: "O valor actual deve ser um número não negativo." }, { status: 400 });
    }

    const result = await monthlyPlanRepository.updateActual(id, entryId, body.actual);
    if (result === "closed") return NextResponse.json({ error: "Este mês está fechado e não pode ser alterado." }, { status: 409 });
    if (result === "not_found") return NextResponse.json({ error: "Mês ou linha não encontrados." }, { status: 404 });

    const plan = await monthlyPlanRepository.findById(id);
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Could not update month entry.", error);
    return NextResponse.json({ error: "Não foi possível guardar o valor actual." }, { status: 500 });
  }
}
