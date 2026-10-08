import { NextResponse } from "next/server";
import { personRepository } from "@/shared/repositories/person-repository";
import { parsePersonInput } from "@/shared/lib/person-validation";

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
    const person = parsePersonInput(await request.json());
    if (!person) return NextResponse.json({ error: "Indica nome e uma configuração financeira válida." }, { status: 400 });

    return NextResponse.json(await personRepository.create(person), { status: 201 });
  } catch (error) {
    console.error("Could not create person.", error);
    return NextResponse.json({ error: "Não foi possível criar a pessoa." }, { status: 500 });
  }
}
