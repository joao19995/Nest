import { NextResponse } from "next/server";
import { categoryTemplateRepository } from "@/shared/repositories/category-template-repository";
import { checkEntryReferences, parseCategoryTemplateEntries } from "@/shared/lib/category-template-validation";
import { isUuid } from "@/shared/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });
    const template = await categoryTemplateRepository.findById(id);
    if (!template) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    console.error("Could not load category template.", error);
    return NextResponse.json({ error: "Não foi possível carregar o template." }, { status: 500 });
  }
}

// Atualiza o conteúdo (entradas) de uma versão existente. O validFrom não muda e nenhuma linha é apagada.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!isUuid(id)) return NextResponse.json({ error: "ID inválido." }, { status: 400 });

    const body = await request.json() as { entries?: unknown };
    const parsed = parseCategoryTemplateEntries(body.entries);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    if (!await categoryTemplateRepository.findById(id)) return NextResponse.json({ error: "Template não encontrado." }, { status: 404 });

    const status = await categoryTemplateRepository.findReferenceStatus(parsed.entries.map((entry) => entry.categoryId), parsed.entries.map((entry) => entry.accountId));
    const existingPairs = await categoryTemplateRepository.findEntryPairs(id);
    const referenceError = checkEntryReferences(parsed.entries, status, existingPairs);
    if (referenceError) return NextResponse.json({ error: referenceError }, { status: 400 });

    return NextResponse.json(await categoryTemplateRepository.replaceEntries(id, parsed.entries));
  } catch (error) {
    console.error("Could not update category template.", error);
    return NextResponse.json({ error: "Não foi possível atualizar o template." }, { status: 500 });
  }
}
