import { NextResponse } from "next/server";
import { accountRepository } from "@/shared/repositories/account-repository";
import { personRepository } from "@/shared/repositories/person-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const body = await request.json() as { name?: unknown; ownerPersonId?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });

    const ownerPersonId = body.ownerPersonId === null ? null : typeof body.ownerPersonId === "string" ? body.ownerPersonId : undefined;
    if (ownerPersonId === undefined) return NextResponse.json({ error: "Indica uma pessoa proprietária ou deixa a conta sem proprietário." }, { status: 400 });
    if (ownerPersonId && !isUuid(ownerPersonId)) return NextResponse.json({ error: "ID da pessoa proprietária inválido." }, { status: 400 });
    if (ownerPersonId && !await personRepository.findById(ownerPersonId)) return NextResponse.json({ error: "A pessoa proprietária não existe." }, { status: 400 });

    const account = await accountRepository.update(id, { name, ownerPersonId });
    if (!account) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    return NextResponse.json(account);
  } catch (error) {
    console.error("Could not update account.", error);
    return NextResponse.json({ error: "Não foi possível atualizar a conta." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    // Soft delete: a conta é desativada (active = false), nunca removida fisicamente.
    const deactivated = await accountRepository.deactivate(id);
    if (!deactivated) return NextResponse.json({ error: "Conta não encontrada." }, { status: 404 });
    return NextResponse.json({ id });
  } catch (error) {
    console.error("Could not delete account.", error);
    return NextResponse.json({ error: "Não foi possível remover a conta." }, { status: 500 });
  }
}
