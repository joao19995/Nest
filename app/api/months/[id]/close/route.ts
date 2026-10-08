import { NextResponse } from "next/server";
import { monthlyPlanRepository } from "@/shared/repositories/monthly-plan-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fechar é definitivo nesta fase (não há reabertura). Depois de fechado, o mês fica read-only.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const result = await monthlyPlanRepository.close(id);
    if (result === "not_found") return NextResponse.json({ error: "Mês não encontrado." }, { status: 404 });
    if (result === "already_closed") return NextResponse.json({ error: "Este mês já está fechado." }, { status: 409 });

    return NextResponse.json(await monthlyPlanRepository.findById(id));
  } catch (error) {
    console.error("Could not close month.", error);
    return NextResponse.json({ error: "Não foi possível fechar o mês." }, { status: 500 });
  }
}
