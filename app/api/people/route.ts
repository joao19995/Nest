import { NextResponse } from "next/server";
import { personRepository } from "@/shared/repositories/person-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await personRepository.findAll());
  } catch (error) {
    console.error("Could not list people.", error);
    return NextResponse.json({ error: "Não foi possível carregar as pessoas." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });

    return NextResponse.json(await personRepository.create({ name }), { status: 201 });
  } catch (error) {
    console.error("Could not create person.", error);
    return NextResponse.json({ error: "Não foi possível criar a pessoa." }, { status: 500 });
  }
}
