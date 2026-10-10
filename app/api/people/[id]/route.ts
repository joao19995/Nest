import { NextResponse } from "next/server";
import { personRepository } from "@/shared/repositories/person-repository";
import { isUuid } from "@/shared/lib/uuid";
import { parsePersonInput } from "@/shared/lib/person-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const input = parsePersonInput(await request.json());
    if (!input) return NextResponse.json({ error: "Indica nome e uma configuração financeira válida." }, { status: 400 });

    const person = await personRepository.update(id, input);
    if (!person) return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
    return NextResponse.json(person);
  } catch (error) {
    console.error("Could not update person.", error);
    return NextResponse.json({ error: "Não foi possível atualizar a pessoa." }, { status: 500 });
  }
}
