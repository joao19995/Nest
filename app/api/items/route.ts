import { NextResponse } from "next/server";
import { categoryRepository } from "@/shared/repositories/category-repository";
import { itemRepository } from "@/shared/repositories/item-repository";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await itemRepository.findAll());
  } catch (error) {
    console.error("Could not list items.", error);
    return NextResponse.json({ error: "Não foi possível carregar os itens." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { categoryId?: unknown; name?: unknown };
    if (typeof body.categoryId !== "string" || !isUuid(body.categoryId)) {
      return NextResponse.json({ error: "ID de categoria inválido." }, { status: 400 });
    }
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 100) return NextResponse.json({ error: "Indica um nome válido (1–100 caracteres)." }, { status: 400 });

    const category = await categoryRepository.findById(body.categoryId);
    if (!category || !category.active) {
      return NextResponse.json({ error: "Categoria não encontrada ou inativa." }, { status: 400 });
    }
    return NextResponse.json(await itemRepository.create(body.categoryId, name), { status: 201 });
  } catch (error) {
    console.error("Could not create item.", error);
    return NextResponse.json({ error: "Não foi possível criar o item." }, { status: 500 });
  }
}
