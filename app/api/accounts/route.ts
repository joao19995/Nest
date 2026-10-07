import { NextResponse } from "next/server";
import { accountRepository } from "@/shared/repositories/account-repository";
import { personRepository } from "@/shared/repositories/person-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await accountRepository.findAll());
  } catch (error) {
    console.error("Could not list accounts.", error);
    return NextResponse.json({ error: "Não foi possível carregar as contas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown; ownerPersonId?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });

    const ownerPersonId = body.ownerPersonId === null ? null : typeof body.ownerPersonId === "string" ? body.ownerPersonId : undefined;
    if (ownerPersonId === undefined) return NextResponse.json({ error: "Indica uma pessoa proprietária ou deixa a conta sem proprietário." }, { status: 400 });
    if (ownerPersonId && !isUuid(ownerPersonId)) return NextResponse.json({ error: "ID da pessoa proprietária inválido." }, { status: 400 });
    if (ownerPersonId && !await personRepository.findById(ownerPersonId)) return NextResponse.json({ error: "A pessoa proprietária não existe." }, { status: 400 });

    return NextResponse.json(await accountRepository.create({ name, ownerPersonId }), { status: 201 });
  } catch (error) {
    console.error("Could not create account.", error);
    return NextResponse.json({ error: "Não foi possível criar a conta." }, { status: 500 });
  }
}
