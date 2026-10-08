import { NextResponse } from "next/server";
import { personIncomeRepository } from "@/shared/repositories/person-income-repository";
import { personRepository } from "@/shared/repositories/person-repository";
import { isUuid } from "@/shared/lib/uuid";
import { parsePersonIncomeInput } from "@/shared/lib/person-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    if (!await personRepository.findById(id)) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    return NextResponse.json(await personIncomeRepository.findAllForPerson(id));
  } catch (error) {
    console.error("Could not load person income history.", error);
    return NextResponse.json({ error: "Não foi possível carregar o histórico salarial." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    if (!await personRepository.findById(id)) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    const input = parsePersonIncomeInput(await request.json());
    if (!input) return NextResponse.json({ error: "Indica um valor e uma data de início válidos." }, { status: 400 });
    return NextResponse.json(await personIncomeRepository.create(id, input), { status: 201 });
  } catch (error) {
    console.error("Could not create person income.", error);
    return NextResponse.json({ error: "Não foi possível adicionar o vencimento." }, { status: 500 });
  }
}
