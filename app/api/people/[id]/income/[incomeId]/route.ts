import { NextResponse } from "next/server";
import { personIncomeRepository } from "@/shared/repositories/person-income-repository";
import { isUuid } from "@/shared/lib/uuid";
import { parsePersonIncomeInput } from "@/shared/lib/person-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string; incomeId: string }> }) {
  try {
    const { id, incomeId } = await context.params;
    if (!isUuid(id) || !isUuid(incomeId)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const input = parsePersonIncomeInput(await request.json());
    if (!input) return NextResponse.json({ error: "Indica um valor e uma data de início válidos." }, { status: 400 });

    const income = await personIncomeRepository.update(id, incomeId, input);
    if (!income) return NextResponse.json({ error: "Vencimento não encontrado." }, { status: 404 });
    return NextResponse.json(income);
  } catch (error) {
    console.error("Could not update person income.", error);
    return NextResponse.json({ error: "Não foi possível atualizar o vencimento." }, { status: 500 });
  }
}
