"use client";

import { useEffect, useState } from "react";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { entitiesClient } from "@/shared/lib/entities-client";
import { loadFinanceState, saveFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { Category, CategoryTemplateEntry, FinanceState } from "@/features/monthly-plan/domain/types";

type TemplateDraft = { expectedAmount: number; active: boolean; accountId: string };
type CategoryDraft = { name: string; type: Category["type"] };

export function CategoriesEditor() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, CategoryDraft>>({});
  const [templateDate, setTemplateDate] = useState("2026-01");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<Category["type"]>("VARIABLE");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void loadFinanceState(initialFinanceState).then((loaded) => {
      if (!active) return;
      const latest = loaded.configuration.categoryTemplates.at(-1) ?? { validFrom: "2026-01", entries: [] };
      setState(loaded);
      setTemplateDate(latest.validFrom);
      setCategoryDrafts(Object.fromEntries(loaded.configuration.categories.map((category) => [category.id, { name: category.name, type: category.type }])));
      setDrafts(Object.fromEntries(loaded.configuration.categories.map((category) => {
        const entry = latest.entries.find((item) => item.categoryId === category.id);
        return [category.id, {
          expectedAmount: entry?.expectedAmount ?? 0,
          active: entry?.active ?? false,
          accountId: entry?.accountId ?? loaded.configuration.accounts.find((account) => account.name === "Conjunta")?.id ?? loaded.configuration.accounts[0]?.id ?? "",
        }];
      })));
    }).catch(showFinanceStorageError);
    return () => { active = false; };
  }, []);

  const selectableCategories = state.configuration.categories.filter((category) => category.active);
  const activeCategories = selectableCategories.filter((category) => drafts[category.id]?.active ?? false);
  const expectedTotal = activeCategories.reduce((sum, category) => sum + (drafts[category.id]?.expectedAmount ?? 0), 0);
  const fixedTotal = activeCategories.filter((category) => category.type === "FIXED").reduce((sum, category) => sum + (drafts[category.id]?.expectedAmount ?? 0), 0);
  const variableTotal = expectedTotal - fixedTotal;

  function changeTemplateDraft(id: string, changes: Partial<TemplateDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
    setSaved(false);
  }

  async function createCategory() {
    setError("");
    try {
      const category = await entitiesClient.createCategory(newCategoryName, newCategoryType);
      setState((current) => ({ ...current, configuration: { ...current.configuration, categories: [...current.configuration.categories, category] } }));
      setCategoryDrafts((current) => ({ ...current, [category.id]: { name: category.name, type: category.type } }));
      const defaultAccountId = state.configuration.accounts.find((account) => account.name === "Conjunta")?.id ?? state.configuration.accounts[0]?.id ?? "";
      setDrafts((current) => ({ ...current, [category.id]: { expectedAmount: 0, active: true, accountId: defaultAccountId } }));
      setNewCategoryName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a categoria.");
    }
  }

  async function updateCategory(category: Category, active: boolean) {
    setError("");
    const draft = categoryDrafts[category.id] ?? { name: category.name, type: category.type };
    try {
      const updated = await entitiesClient.updateCategory(category.id, draft.name, draft.type, active);
      setState((current) => ({ ...current, configuration: { ...current.configuration, categories: current.configuration.categories.map((item) => item.id === category.id ? updated : item) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a categoria.");
    }
  }

  async function deactivateCategory(category: Category) {
    setError("");
    try {
      const updated = await entitiesClient.deactivateCategory(category.id);
      setState((current) => ({ ...current, configuration: { ...current.configuration, categories: current.configuration.categories.map((item) => item.id === category.id ? updated : item) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desativar a categoria.");
    }
  }

  function saveTemplate() {
    const currentTemplate = state.configuration.categoryTemplates.find((template) => template.validFrom === templateDate);
    const preservedInactiveEntries = currentTemplate?.entries.filter((entry) => !selectableCategories.some((category) => category.id === entry.categoryId)) ?? [];
    const entries: CategoryTemplateEntry[] = [...preservedInactiveEntries, ...selectableCategories.map((category) => ({
      categoryId: category.id,
      accountId: drafts[category.id]?.accountId ?? state.configuration.accounts.find((account) => account.name === "Conjunta")?.id ?? state.configuration.accounts[0]?.id ?? "",
      expectedAmount: drafts[category.id]?.expectedAmount ?? 0,
      active: drafts[category.id]?.active ?? false,
    }))];
    const categoryTemplates = [...state.configuration.categoryTemplates.filter((template) => template.validFrom !== templateDate), { validFrom: templateDate, entries }].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    const nextState = { ...state, configuration: { ...state.configuration, categoryTemplates } };
    setState(nextState);
    saveFinanceState(nextState);
    setSaved(true);
  }

  return (
    <main className="shell compact-shell">
      <AppNav active="categories" />
      <div className="page-heading"><p className="eyebrow">Configuração</p><h1>Categorias</h1><p className="lede">Gere categorias e templates mensais separadamente.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Gestão</p><h2>Gerir categorias</h2></div><span className="settings-status">PostgreSQL</span></div>
        <div className="entity-create-row">
          <label>Nome<input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} maxLength={100} /></label>
          <label>Tipo<select value={newCategoryType} onChange={(event) => setNewCategoryType(event.target.value as Category["type"])}><option value="FIXED">Fixa</option><option value="VARIABLE">Variável</option></select></label>
          <button className="secondary-button" onClick={createCategory}>+ Nova categoria</button>
        </div>
        <div className="category-table category-management">
          <div className="category-table-row category-table-header"><span>Nome</span><span>Tipo</span><span>Estado</span><span>Ação</span></div>
          {state.configuration.categories.map((category) => {
            const draft = categoryDrafts[category.id] ?? { name: category.name, type: category.type };
            return <div className="category-table-row" key={category.id}>
              <label><input value={draft.name} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category.id]: { ...draft, name: event.target.value } }))} maxLength={100} /></label>
              <select value={draft.type} onChange={(event) => setCategoryDrafts((current) => ({ ...current, [category.id]: { ...draft, type: event.target.value as Category["type"] } }))}><option value="FIXED">Fixa</option><option value="VARIABLE">Variável</option></select>
              <span className={`category-state ${category.active ? "is-active" : "is-inactive"}`}>{category.active ? "Ativa" : "Inativa"}</span>
              <div className="entity-action-buttons">
                <button className="inline-button" onClick={() => updateCategory(category, category.active)}>Editar</button>
                {category.active
                  ? <button className="remove-button" aria-label={`Desativar ${category.name}`} title="Desativar" onClick={() => deactivateCategory(category)}>Desativar</button>
                  : <button className="inline-button" onClick={() => updateCategory(category, true)}>Reativar</button>}
              </div>
            </div>;
          })}
        </div>
      </section>

      <section className="category-totals">
        <article className="panel"><p className="eyebrow">Template ativo + margem</p><h2><Money value={expectedTotal * 1.1} /></h2><p>{activeCategories.length} categorias ativas com 10%.</p></article>
        <article className="panel"><p className="eyebrow">Despesas fixas</p><h2><Money value={fixedTotal} /></h2><p>Categorias do tipo Fixa.</p></article>
        <article className="panel"><p className="eyebrow">Despesas variáveis</p><h2><Money value={variableTotal} /></h2><p>Categorias do tipo Variável.</p></article>
      </section>

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Template local</p><h2>Template mensal</h2></div><label className="template-date">Aplicável a partir de <input type="month" value={templateDate} onChange={(event) => setTemplateDate(event.target.value)} /></label></div>
        <p className="form-note">O template mensal continua guardado localmente. A conta pertence ao template, não à categoria.</p>
        <div className="category-table category-template">
          <div className="category-table-row category-table-header"><span>Categoria</span><span>Conta</span><span>Valor esperado</span><span>Usar no template</span></div>
          {selectableCategories.map((category) => {
            const draft = drafts[category.id] ?? { expectedAmount: 0, active: false, accountId: state.configuration.accounts.find((account) => account.name === "Conjunta")?.id ?? "" };
            return <div className="category-table-row" key={category.id}>
              <strong>{category.name}<small>{category.type === "FIXED" ? "Fixa" : "Variável"}</small></strong>
              <select aria-label={`Conta do template para ${category.name}`} value={draft.accountId} onChange={(event) => changeTemplateDraft(category.id, { accountId: event.target.value })}>{state.configuration.accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select>
              <label><input type="number" value={draft.expectedAmount} onChange={(event) => changeTemplateDraft(category.id, { expectedAmount: Number(event.target.value) })} /></label>
              <label className="active-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => changeTemplateDraft(category.id, { active: event.target.checked })} /><span>{draft.active ? "Sim" : "Não"}</span></label>
            </div>;
          })}
        </div>
        <div className="editor-actions template-actions"><button className="save-button" onClick={saveTemplate}>{saved ? "Guardado localmente" : "Guardar template"}</button></div>
      </section>
    </main>
  );
}
