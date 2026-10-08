"use client";

import { useEffect, useState } from "react";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { entitiesClient } from "@/shared/lib/entities-client";
import { loadFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { Account, Category, CategoryTemplateEntry, CategoryTemplateView, FinanceState } from "@/features/monthly-plan/domain/types";

type TemplateDraft = { expectedAmount: number; active: boolean; accountId: string };
type CategoryForm = { name: string; type: Category["type"] };

const editIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
const removeIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
const restoreIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Template aplicável a um mês: o de validFrom mais recente que seja <= mês.
function applicableTemplate(templates: CategoryTemplateView[], month: string): CategoryTemplateView | null {
  return templates.filter((template) => template.validFrom <= month).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1) ?? null;
}

function buildDrafts(categories: Category[], accounts: Account[], base: CategoryTemplateView | null): Record<string, TemplateDraft> {
  const fallbackAccountId = accounts.find((account) => account.name === "Conjunta")?.id ?? accounts[0]?.id ?? "";
  return Object.fromEntries(categories.filter((category) => category.active).map((category) => {
    const entry = base?.entries.find((item) => item.categoryId === category.id);
    return [category.id, {
      expectedAmount: entry?.expectedAmount ?? 0,
      active: entry?.active ?? false,
      accountId: entry?.accountId ?? fallbackAccountId,
    }];
  }));
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function CategoriesEditor() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [templates, setTemplates] = useState<CategoryTemplateView[]>([]);
  const [templateDate, setTemplateDate] = useState(currentMonth());
  const [drafts, setDrafts] = useState<Record<string, TemplateDraft>>({});
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: "", type: "VARIABLE" });
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([loadFinanceState(initialFinanceState), entitiesClient.getCategoryTemplates()]).then(([loaded, loadedTemplates]) => {
      if (!active) return;
      const latest = loadedTemplates.at(-1)?.validFrom ?? currentMonth();
      setState(loaded);
      setTemplates(loadedTemplates);
      setTemplateDate(latest);
      setDrafts(buildDrafts(loaded.configuration.categories, loaded.configuration.accounts, applicableTemplate(loadedTemplates, latest)));
    }).catch(showFinanceStorageError);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!categoryModalOpen || savingCategory) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCategoryModalOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [categoryModalOpen, savingCategory]);

  const selectableCategories = state.configuration.categories.filter((category) => category.active);
  const existingTemplate = templates.find((template) => template.validFrom === templateDate) ?? null;
  const isNewVersion = existingTemplate === null;
  const base = applicableTemplate(templates, templateDate);
  // Entradas de categorias inativas só se mantêm ao editar uma versão existente (são histórico, não novas opções).
  const historicalEntries = isNewVersion ? [] : (base?.entries.filter((entry) => !entry.categoryActive) ?? []);

  const totalRows = [
    ...selectableCategories.filter((category) => drafts[category.id]?.active).map((category) => ({ type: category.type, amount: drafts[category.id].expectedAmount })),
    ...historicalEntries.filter((entry) => entry.active).map((entry) => ({ type: entry.categoryType, amount: entry.expectedAmount })),
  ];
  const expectedTotal = totalRows.reduce((sum, row) => sum + row.amount, 0);
  const fixedTotal = totalRows.filter((row) => row.type === "FIXED").reduce((sum, row) => sum + row.amount, 0);
  const variableTotal = expectedTotal - fixedTotal;

  // Contas: as ativas, mais as inativas que já existam nesta versão (nunca substituídas silenciosamente).
  const accountOptions = [
    ...state.configuration.accounts.map((account) => ({ id: account.id, label: account.name })),
    ...(base?.entries ?? []).filter((entry) => !entry.accountActive && !state.configuration.accounts.some((account) => account.id === entry.accountId))
      .filter((entry, index, all) => all.findIndex((item) => item.accountId === entry.accountId) === index)
      .map((entry) => ({ id: entry.accountId, label: `${entry.accountName} (inativa)` })),
  ];

  function changeTemplateDraft(id: string, changes: Partial<TemplateDraft>) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
    setSaved(false);
  }

  function selectTemplateMonth(month: string) {
    setTemplateDate(month);
    setTemplateError("");
    setSaved(false);
    if (MONTH_PATTERN.test(month)) setDrafts(buildDrafts(state.configuration.categories, state.configuration.accounts, applicableTemplate(templates, month)));
  }

  async function saveTemplate() {
    setTemplateError("");
    setTemplateSaving(true);
    const entries: CategoryTemplateEntry[] = [
      ...selectableCategories.map((category) => ({
        categoryId: category.id,
        accountId: drafts[category.id]?.accountId ?? "",
        expectedAmount: drafts[category.id]?.expectedAmount ?? 0,
        active: drafts[category.id]?.active ?? false,
      })),
      ...historicalEntries.map((entry) => ({ categoryId: entry.categoryId, accountId: entry.accountId, expectedAmount: entry.expectedAmount, active: entry.active })),
    ];
    try {
      const result = existingTemplate
        ? await entitiesClient.updateCategoryTemplate(existingTemplate.id, entries)
        : await entitiesClient.createCategoryTemplate({ validFrom: templateDate, entries });
      setTemplates((current) => [...current.filter((template) => template.id !== result.id), result].sort((a, b) => a.validFrom.localeCompare(b.validFrom)));
      setSaved(true);
    } catch (cause) {
      setTemplateError(cause instanceof Error ? cause.message : "Não foi possível guardar o template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  function openCreateCategory() {
    setEditingCategoryId(null);
    setCategoryForm({ name: "", type: "VARIABLE" });
    setCategoryFormError("");
    setCategoryModalOpen(true);
  }

  function openEditCategory(category: Category) {
    setEditingCategoryId(category.id);
    setCategoryForm({ name: category.name, type: category.type });
    setCategoryFormError("");
    setCategoryModalOpen(true);
  }

  async function saveCategory() {
    setCategoryFormError("");
    setSavingCategory(true);
    try {
      if (editingCategoryId) {
        const current = state.configuration.categories.find((item) => item.id === editingCategoryId);
        const updated = await entitiesClient.updateCategory(editingCategoryId, categoryForm.name, categoryForm.type, current?.active ?? true);
        setState((prev) => ({ ...prev, configuration: { ...prev.configuration, categories: prev.configuration.categories.map((item) => item.id === updated.id ? updated : item) } }));
      } else {
        const category = await entitiesClient.createCategory(categoryForm.name, categoryForm.type);
        setState((prev) => ({ ...prev, configuration: { ...prev.configuration, categories: [...prev.configuration.categories, category] } }));
        const defaultAccountId = state.configuration.accounts.find((account) => account.name === "Conjunta")?.id ?? state.configuration.accounts[0]?.id ?? "";
        setDrafts((current) => ({ ...current, [category.id]: { expectedAmount: 0, active: true, accountId: defaultAccountId } }));
      }
      setCategoryModalOpen(false);
    } catch (cause) {
      setCategoryFormError(cause instanceof Error ? cause.message : "Não foi possível guardar a categoria.");
    } finally {
      setSavingCategory(false);
    }
  }

  async function reactivateCategory(category: Category) {
    setError("");
    try {
      const updated = await entitiesClient.updateCategory(category.id, category.name, category.type, true);
      setState((current) => ({ ...current, configuration: { ...current.configuration, categories: current.configuration.categories.map((item) => item.id === category.id ? updated : item) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível reativar a categoria.");
    }
  }

  async function deactivateCategory(category: Category) {
    if (!window.confirm(`Desativar a categoria ${category.name}?`)) return;
    setError("");
    try {
      const updated = await entitiesClient.deactivateCategory(category.id);
      setState((current) => ({ ...current, configuration: { ...current.configuration, categories: current.configuration.categories.map((item) => item.id === category.id ? updated : item) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desativar a categoria.");
    }
  }

  return (
    <main className="shell compact-shell">
      <AppNav active="categories" />
      <div className="page-heading"><p className="eyebrow">Configuração</p><h1>Categorias</h1><p className="lede">Gere categorias e templates mensais separadamente.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Gestão</p><h2>Gerir categorias</h2></div><button className="secondary-button" onClick={openCreateCategory}>+ Nova categoria</button></div>
        <div className="category-table category-management">
          <div className="category-table-row category-table-header"><span>Nome</span><span>Tipo</span><span>Estado</span><span>Ação</span></div>
          {state.configuration.categories.map((category) => <div className="category-table-row" key={category.id}>
            <strong>{category.name}</strong>
            <span>{category.type === "FIXED" ? "Fixa" : "Variável"}</span>
            <span className={`category-state ${category.active ? "is-active" : "is-inactive"}`}>{category.active ? "Ativa" : "Inativa"}</span>
            <div className="entity-action-buttons">
              <button className="entity-edit-button" type="button" title={`Editar ${category.name}`} aria-label={`Editar categoria ${category.name}`} onClick={() => openEditCategory(category)}>{editIcon}</button>
              {category.active
                ? <button className="entity-edit-button entity-remove-button" type="button" title={`Desativar ${category.name}`} aria-label={`Desativar categoria ${category.name}`} onClick={() => void deactivateCategory(category)}>{removeIcon}</button>
                : <button className="entity-edit-button" type="button" title={`Reativar ${category.name}`} aria-label={`Reativar categoria ${category.name}`} onClick={() => void reactivateCategory(category)}>{restoreIcon}</button>}
            </div>
          </div>)}
        </div>
      </section>

      {categoryModalOpen && <div className="entity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingCategory) setCategoryModalOpen(false); }}>
        <section className="entity-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
          <div className="entity-modal-heading"><div><p className="eyebrow">Categorias</p><h2 id="category-modal-title">{editingCategoryId ? "Editar categoria" : "Nova categoria"}</h2></div><button className="entity-modal-close" type="button" aria-label="Fechar" onClick={() => setCategoryModalOpen(false)} disabled={savingCategory}>×</button></div>
          <form onSubmit={(event) => { event.preventDefault(); void saveCategory(); }}>
            <label className="entity-modal-field">Nome<input autoFocus required maxLength={100} value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="entity-modal-field">Tipo<select value={categoryForm.type} onChange={(event) => setCategoryForm((current) => ({ ...current, type: event.target.value as Category["type"] }))}><option value="FIXED">Fixa</option><option value="VARIABLE">Variável</option></select></label>
            {categoryFormError && <p className="form-error" role="alert">{categoryFormError}</p>}
            <div className="entity-modal-actions"><button className="secondary-button" type="button" onClick={() => setCategoryModalOpen(false)} disabled={savingCategory}>Cancelar</button><button className="save-button" type="submit" disabled={savingCategory}>{savingCategory ? "A guardar…" : "Guardar categoria"}</button></div>
          </form>
        </section>
      </div>}

      <section className="category-totals">
        <article className="panel"><p className="eyebrow">Template ativo + margem</p><h2><Money value={expectedTotal * 1.1} /></h2><p>{totalRows.length} entradas ativas com 10%.</p></article>
        <article className="panel"><p className="eyebrow">Despesas fixas</p><h2><Money value={fixedTotal} /></h2><p>Categorias do tipo Fixa.</p></article>
        <article className="panel"><p className="eyebrow">Despesas variáveis</p><h2><Money value={variableTotal} /></h2><p>Categorias do tipo Variável.</p></article>
      </section>

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Template</p><h2>Template mensal</h2></div><label className="template-date">Aplicável a partir de <input type="month" value={templateDate} onChange={(event) => selectTemplateMonth(event.target.value)} /></label></div>
        <p className="form-note">
          {isNewVersion
            ? `Não existe template com início em ${templateDate}. Ao guardar, cria-se uma nova versão; o template anterior mantém-se para histórico.`
            : `A editar o template com início em ${templateDate}. A conta pertence ao template, não à categoria.`}
        </p>
        {templateError && <p className="form-error" role="alert">{templateError}</p>}
        <div className="category-table category-template">
          <div className="category-table-row category-table-header"><span>Categoria</span><span>Conta</span><span>Valor esperado</span><span>Usar no template</span></div>
          {selectableCategories.map((category) => {
            const draft = drafts[category.id] ?? { expectedAmount: 0, active: false, accountId: "" };
            return <div className="category-table-row" key={category.id}>
              <strong>{category.name}<small>{category.type === "FIXED" ? "Fixa" : "Variável"}</small></strong>
              <select aria-label={`Conta do template para ${category.name}`} value={draft.accountId} onChange={(event) => changeTemplateDraft(category.id, { accountId: event.target.value })}>{accountOptions.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select>
              <label><input type="number" min="0" value={draft.expectedAmount} onChange={(event) => changeTemplateDraft(category.id, { expectedAmount: Number(event.target.value) })} /></label>
              <label className="active-toggle"><input type="checkbox" checked={draft.active} onChange={(event) => changeTemplateDraft(category.id, { active: event.target.checked })} /><span>{draft.active ? "Sim" : "Não"}</span></label>
            </div>;
          })}
          {historicalEntries.map((entry) => <div className="category-table-row" key={`historical-${entry.categoryId}`}>
            <strong>{entry.categoryName}<small>Categoria inativa · histórico</small></strong>
            <span>{entry.accountName}{entry.accountActive ? "" : " (inativa)"}</span>
            <span><Money value={entry.expectedAmount} /></span>
            <span>{entry.active ? "Sim" : "Não"}</span>
          </div>)}
        </div>
        <div className="editor-actions template-actions"><button className="save-button" onClick={() => void saveTemplate()} disabled={templateSaving || !MONTH_PATTERN.test(templateDate)}>{templateSaving ? "A guardar…" : saved ? "Guardado" : "Guardar template"}</button></div>
      </section>
    </main>
  );
}
