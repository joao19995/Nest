import { NextResponse } from "next/server";
import { goalRepository } from "@/shared/repositories/goal-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const body = (await request.json()) as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return NextResponse.json({ error: "Indica um nome até 100 caracteres." }, { status: 400 });
    }
    const updated = await goalRepository.rename(id, body.name.trim());
    if (!updated) return NextResponse.json({ error: "Objetivo não encontrado." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Could not rename goal.", error);
    return NextResponse.json({ error: "Não foi possível editar o objetivo." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const archived = await goalRepository.archive(id);
    if (!archived) return NextResponse.json({ error: "Objetivo não encontrado." }, { status: 404 });
    return NextResponse.json({ id });
  } catch (error) {
    console.error("Could not delete goal.", error);
    return NextResponse.json({ error: "Não foi possível apagar o objetivo." }, { status: 500 });
  }
}
