"use client";

import { useEffect, useState } from "react";
import { initialFinanceState } from "@/shared/lib/finance-demo-state";
import { entitiesClient } from "@/shared/lib/entities-client";
import { loadFinanceState, showFinanceStorageError } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";
import type { Account, Category, CategoryTemplateEntry, CategoryTemplateView, FinanceState } from "@/features/monthly-plan/domain/types";

type CategoryForm = { name: string; type: Category["type"] };
type TemplateRow = { categoryId: string; accountId: string; expectedAmount: number };

const editIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>;
const removeIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>;
const restoreIcon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

// Template aplicável a um mês: o de validFrom mais recente que seja <= mês.
function applicableTemplate(templates: CategoryTemplateView[], month: string): CategoryTemplateView | null {
  return templates.filter((template) => template.validFrom <= month).sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1) ?? null;
}

function defaultAccountId(accounts: Account[]) {
  return accounts.find((account) => account.name === "Conjunta")?.id ?? accounts[0]?.id ?? "";
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function CategoriesEditor() {
  const [state, setState] = useState<FinanceState>(initialFinanceState);
  const [templates, setTemplates] = useState<CategoryTemplateView[]>([]);
  const [templateDate, setTemplateDate] = useState(currentMonth());
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateRows, setTemplateRows] = useState<TemplateRow[]>([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateError, setTemplateError] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({ name: "", type: "VARIABLE" });
  const [savingCategory, setSavingCategory] = useState(false);
  const [categoryFormError, setCategoryFormError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([loadFinanceState(), entitiesClient.getCategoryTemplates()]).then(([loaded, loadedTemplates]) => {
      if (!active) return;
      setState(loaded);
      setTemplates(loadedTemplates);
      setTemplateDate(loadedTemplates.at(-1)?.validFrom ?? currentMonth());
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

  useEffect(() => {
    if (!templateModalOpen || templateSaving) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setTemplateModalOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [templateModalOpen, templateSaving]);

  const selectableCategories = state.configuration.categories.filter((category) => category.active);
  const base = applicableTemplate(templates, templateDate);
  const existingTemplate = templates.find((template) => template.validFrom === templateDate) ?? null;
  const isNewVersion = existingTemplate === null;

  // O painel mostra só o que está ativo no template aplicável ao mês escolhido.
  const visibleEntries = (base?.entries ?? []).filter((entry) => entry.active);
  const expectedTotal = visibleEntries.reduce((sum, entry) => sum + entry.expectedAmount, 0);
  const fixedTotal = visibleEntries.filter((entry) => entry.categoryType === "FIXED").reduce((sum, entry) => sum + entry.expectedAmount, 0);
  const variableTotal = expectedTotal - fixedTotal;

  // Contas e categorias conhecidas, incluindo as inativas que já estejam no template (histórico).
  const allTemplateEntries = templates.flatMap((template) => template.entries);
  function accountLabel(accountId: string) {
    const account = state.configuration.accounts.find((item) => item.id === accountId);
    if (account) return account.name;
    const historical = allTemplateEntries.find((entry) => entry.accountId === accountId);
    return historical ? `${historical.accountName} (inativa)` : "Conta inativa";
  }
  function categoryLabel(categoryId: string) {
    const category = state.configuration.categories.find((item) => item.id === categoryId);
    if (!category) return "Categoria";
    return category.active ? category.name : `${category.name} (inativa)`;
  }

  function openTemplateModal() {
    setTemplateError("");
    setTemplateRows((base?.entries ?? []).filter((entry) => entry.active).map((entry) => ({
      categoryId: entry.categoryId,
      accountId: entry.accountId,
      expectedAmount: entry.expectedAmount,
    })));
    setTemplateModalOpen(true);
  }

  function updateTemplateRow(index: number, changes: Partial<TemplateRow>) {
    setTemplateRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...changes } : row));
  }

  function addTemplateRow() {
    const used = new Set(templateRows.map((row) => row.categoryId));
    const next = selectableCategories.find((category) => !used.has(category.id));
    if (!next) return;
    setTemplateRows((current) => [...current, { categoryId: next.id, accountId: defaultAccountId(state.configuration.accounts), expectedAmount: 0 }]);
  }

  function removeTemplateRow(index: number) {
    setTemplateRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function saveTemplate() {
    setTemplateError("");
    setTemplateSaving(true);
    const entries: CategoryTemplateEntry[] = templateRows.map((row) => ({
      categoryId: row.categoryId,
      accountId: row.accountId,
      expectedAmount: row.expectedAmount,
      active: true,
    }));
    try {
      // Linhas removidas ficam active = false na versão existente (histórico preservado).
      const result = existingTemplate
        ? await entitiesClient.updateCategoryTemplate(existingTemplate.id, entries)
        : await entitiesClient.createCategoryTemplate({ validFrom: templateDate, entries });
      setTemplates((current) => [...current.filter((template) => template.id !== result.id), result].sort((a, b) => a.validFrom.localeCompare(b.validFrom)));
      setTemplateModalOpen(false);
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

  const usedCategoryIds = new Set(templateRows.map((row) => row.categoryId));
  const canAddTemplateRow = selectableCategories.some((category) => !usedCategoryIds.has(category.id));
  const templateAccountIds = [...state.configuration.accounts.map((account) => account.id), ...templateRows.map((row) => row.accountId)]
    .filter((accountId, index, all) => all.indexOf(accountId) === index);

  return (
    <main className="shell compact-shell">
      <AppNav active="categories" />
      <div className="page-heading"><p className="eyebrow">Configuração</p><h1>Categorias</h1><p className="lede">Gere categorias e templates mensais separadamente.</p></div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="category-totals">
        <article className="panel"><p className="eyebrow">Template ativo</p><h2><Money value={expectedTotal} /></h2><p>{visibleEntries.length} entradas ativas.</p></article>
        <article className="panel"><p className="eyebrow">Despesas fixas</p><h2><Money value={fixedTotal} /></h2><p>Categorias do tipo Fixa.</p></article>
        <article className="panel"><p className="eyebrow">Despesas variáveis</p><h2><Money value={variableTotal} /></h2><p>Categorias do tipo Variável.</p></article>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <div><p className="eyebrow">Template</p><h2>Template mensal</h2></div>
          <div className="entity-action-buttons">
            <label className="template-date">Aplicável a partir de <input type="month" value={templateDate} onChange={(event) => { if (MONTH_PATTERN.test(event.target.value)) setTemplateDate(event.target.value); }} /></label>
            <button className="entity-edit-button" type="button" title="Criar ou editar template" aria-label="Criar ou editar template" onClick={openTemplateModal}>{editIcon}</button>
          </div>
        </div>
        <p className="form-note">
          {isNewVersion
            ? `Sem template próprio a partir de ${templateDate}: a mostrar o template anterior. Ao editar, cria-se uma nova versão.`
            : `Template a partir de ${templateDate}. A conta pertence ao template, não à categoria.`}
        </p>
        <div className="category-table category-template">
          <div className="category-table-row category-table-header"><span>Categoria</span><span>Conta</span><span>Valor esperado</span><span>Tipo</span></div>
          {visibleEntries.map((entry) => <div className="category-table-row" key={entry.categoryId}>
            <strong>{entry.categoryName}{!entry.categoryActive && <small>Categoria inativa · histórico</small>}</strong>
            <span>{entry.accountName}{entry.accountActive ? "" : " (inativa)"}</span>
            <span><Money value={entry.expectedAmount} /></span>
            <span>{entry.categoryType === "FIXED" ? "Fixa" : "Variável"}</span>
          </div>)}
          {!visibleEntries.length && <p className="form-note">Este template não tem categorias ativas.</p>}
        </div>
      </section>

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

      {templateModalOpen && <div className="entity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !templateSaving) setTemplateModalOpen(false); }}>
        <section className="entity-modal template-modal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title">
          <div className="entity-modal-heading"><div><p className="eyebrow">Template mensal</p><h2 id="template-modal-title">{isNewVersion ? "Novo template" : "Editar template"}</h2></div><button className="entity-modal-close" type="button" aria-label="Fechar" onClick={() => setTemplateModalOpen(false)} disabled={templateSaving}>×</button></div>
          <p className="form-note">{isNewVersion ? `Nova versão a partir de ${templateDate}. O template anterior mantém-se para histórico.` : `Template a partir de ${templateDate}.`}</p>
          <form onSubmit={(event) => { event.preventDefault(); void saveTemplate(); }}>
            <div className="template-entry-list">
              {templateRows.length === 0 && <p className="form-note">Sem categorias neste template. Adiciona a primeira.</p>}
              {templateRows.map((row, index) => {
                const rowOtherIds = new Set(templateRows.filter((_, rowIndex) => rowIndex !== index).map((item) => item.categoryId));
                const categoryOptions = state.configuration.categories.filter((category) => (category.active && !rowOtherIds.has(category.id)) || category.id === row.categoryId);
                const accountOptions = templateAccountIds;
                return <div className="template-entry-row" key={`${row.categoryId}-${index}`}>
                  <select aria-label="Categoria" value={row.categoryId} onChange={(event) => updateTemplateRow(index, { categoryId: event.target.value })}>{categoryOptions.map((category) => <option value={category.id} key={category.id}>{categoryLabel(category.id)}</option>)}</select>
                  <select aria-label="Conta" value={row.accountId} onChange={(event) => updateTemplateRow(index, { accountId: event.target.value })}>{accountOptions.map((accountId) => <option value={accountId} key={accountId}>{accountLabel(accountId)}</option>)}</select>
                  <input type="number" min="0" step="0.01" aria-label="Valor esperado" value={row.expectedAmount} onChange={(event) => updateTemplateRow(index, { expectedAmount: Number(event.target.value) })} />
                  <button className="entity-edit-button entity-remove-button" type="button" title="Remover do template" aria-label={`Remover ${categoryLabel(row.categoryId)} do template`} onClick={() => removeTemplateRow(index)}>{removeIcon}</button>
                </div>;
              })}
            </div>
            <div className="entity-action-buttons" style={{ marginTop: 14 }}>
              <button className="secondary-button" type="button" onClick={addTemplateRow} disabled={!canAddTemplateRow}>+ Adicionar categoria</button>
            </div>
            {templateError && <p className="form-error" role="alert">{templateError}</p>}
            <div className="entity-modal-actions"><button className="secondary-button" type="button" onClick={() => setTemplateModalOpen(false)} disabled={templateSaving}>Cancelar</button><button className="save-button" type="submit" disabled={templateSaving}>{templateSaving ? "A guardar…" : "Guardar template"}</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}
