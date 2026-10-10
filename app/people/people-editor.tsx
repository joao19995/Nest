"use client";

import { useEffect, useState } from "react";
import type { Account, FinanceState, Person, PersonIncome } from "@/features/monthly-plan/domain/types";
import { applicableIncome } from "@/features/monthly-plan/domain/month-planning";
import { entitiesClient } from "@/shared/lib/entities-client";
import { emptyFinanceState } from "@/shared/lib/finance-storage";
import { AppNav } from "@/shared/ui/app-nav";
import { Money } from "@/shared/ui/money";

type PersonDraft = Omit<Person, "id">;
type PersonIncomeDraft = { id?: string; amount: number; validFrom: string };
type AccountDraft = { name: string; ownerPersonId: string | null };

function defaultPersonDraft(name = ""): PersonDraft {
  return { name, dailySpendingPercentage: 25, emergencyFundMonths: 6 };
}

function currentIncome(incomes: PersonIncome[], personId: string, month: string) {
  return incomes.filter((income) => income.personId === personId && income.validFrom.slice(0, 7) <= month)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom)).at(-1);
}

export function PeopleEditor() {
  const [state, setState] = useState<FinanceState>(emptyFinanceState);
  const [personForm, setPersonForm] = useState<PersonDraft>(defaultPersonDraft());
  const [personIncomeForm, setPersonIncomeForm] = useState<PersonIncomeDraft[]>([]);
  const [personModalOpen, setPersonModalOpen] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [accountForm, setAccountForm] = useState<AccountDraft>({ name: "", ownerPersonId: null });
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [removingAccountId, setRemovingAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPersonId, setSavingPersonId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    // Só pessoas, contas e rendimentos: esta página não depende de categorias nem templates.
    void (async () => {
      const people = await entitiesClient.getPeople();
      const [accounts, ...incomesByPerson] = await Promise.all([
        entitiesClient.getAccounts(),
        ...people.map((person) => entitiesClient.getPersonIncomes(person.id)),
      ]);
      if (!active) return;
      setState({ configuration: { people, personIncomes: incomesByPerson.flat(), accounts, categories: [], categoryTemplates: [] } });
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar os dados financeiros.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if ((!accountModalOpen && !personModalOpen) || savingAccount || savingPersonId) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountModalOpen(false);
        setPersonModalOpen(false);
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountModalOpen, personModalOpen, savingAccount, savingPersonId]);

  const referenceMonth = new Date().toISOString().slice(0, 7);
  const incomeByPerson = state.configuration.people.map((person) => ({ personId: person.id, amount: applicableIncome(state.configuration.personIncomes, person.id, referenceMonth) }));
  const dailySpending = incomeByPerson.reduce((total, item) => {
    const person = state.configuration.people.find((entry) => entry.id === item.personId);
    return total + (item.amount * (person?.dailySpendingPercentage ?? 0)) / 100;
  }, 0);
  const annualSubsidies = incomeByPerson.reduce((total, item) => total + item.amount * 2, 0);

  function openCreatePerson() {
    setError("");
    setEditingPersonId(null);
    setPersonForm(defaultPersonDraft());
    setPersonIncomeForm([]);
    setPersonModalOpen(true);
  }

  function openEditPerson(person: Person) {
    setError("");
    setEditingPersonId(person.id);
    const { id: _id, ...draft } = person;
    setPersonForm(draft);
    setPersonIncomeForm(state.configuration.personIncomes.filter((income) => income.personId === person.id).map(({ id, amount, validFrom }) => ({ id, amount, validFrom })));
    setPersonModalOpen(true);
  }

  function updatePersonIncomeDraft(index: number, changes: Partial<PersonIncomeDraft>) {
    setPersonIncomeForm((current) => current.map((income, itemIndex) => itemIndex === index ? { ...income, ...changes } : income));
  }

  function addPersonIncomeDraft() {
    const today = new Date().toISOString().slice(0, 10);
    setPersonIncomeForm((current) => [...current, { amount: 0, validFrom: today }]);
  }

  async function savePerson() {
    setError("");
    setSavingPersonId(editingPersonId ?? "new");
    try {
      let person: Person;
      if (editingPersonId) {
        person = await entitiesClient.updatePerson(editingPersonId, personForm);
        setState((current) => ({ ...current, configuration: { ...current.configuration, people: current.configuration.people.map((item) => item.id === person.id ? person : item) } }));
      } else {
        person = await entitiesClient.createPerson(personForm);
        setEditingPersonId(person.id);
        setPersonForm({ name: person.name, dailySpendingPercentage: person.dailySpendingPercentage, emergencyFundMonths: person.emergencyFundMonths });
        setState((current) => ({ ...current, configuration: { ...current.configuration, people: [...current.configuration.people, person] } }));
      }

      for (let index = 0; index < personIncomeForm.length; index++) {
        const income = personIncomeForm[index];
        const savedIncome = income.id
          ? await entitiesClient.updatePersonIncome(person.id, income.id, { amount: income.amount, validFrom: income.validFrom })
          : await entitiesClient.createPersonIncome(person.id, { amount: income.amount, validFrom: income.validFrom });
        setPersonIncomeForm((current) => current.map((item, itemIndex) => itemIndex === index ? savedIncome : item));
        setState((current) => ({
          ...current,
          configuration: {
            ...current.configuration,
            personIncomes: [
              ...current.configuration.personIncomes.filter((item) => item.id !== income.id),
              savedIncome,
            ],
          },
        }));
      }

      setPersonModalOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a pessoa.");
    } finally {
      setSavingPersonId(null);
    }
  }

  function openCreateAccount() {
    setError("");
    setEditingAccountId(null);
    setAccountForm({ name: "", ownerPersonId: null });
    setAccountModalOpen(true);
  }

  function openEditAccount(account: Account) {
    setError("");
    setEditingAccountId(account.id);
    setAccountForm({ name: account.name, ownerPersonId: account.ownerPersonId });
    setAccountModalOpen(true);
  }

  async function saveAccount() {
    setError("");
    setSavingAccount(true);
    try {
      if (editingAccountId) {
        const account = await entitiesClient.updateAccount(editingAccountId, accountForm.name, accountForm.ownerPersonId);
        setState((current) => ({ ...current, configuration: { ...current.configuration, accounts: current.configuration.accounts.map((item) => item.id === account.id ? account : item) } }));
      } else {
        const account = await entitiesClient.createAccount(accountForm.name, accountForm.ownerPersonId);
        setState((current) => ({ ...current, configuration: { ...current.configuration, accounts: [...current.configuration.accounts, account] } }));
      }
      setAccountModalOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível guardar a conta.");
    } finally {
      setSavingAccount(false);
    }
  }

  async function removeAccount(account: Account) {
    if (!window.confirm(`Remover a conta ${account.name}?`)) return;
    setError("");
    setRemovingAccountId(account.id);
    try {
      await entitiesClient.deleteAccount(account.id);
      setState((current) => ({ ...current, configuration: { ...current.configuration, accounts: current.configuration.accounts.filter((item) => item.id !== account.id) } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover a conta.");
    } finally {
      setRemovingAccountId(null);
    }
  }

  return (
    <main className="shell compact-shell">
      <AppNav active="people" />
      <div className="page-heading">
        <p className="eyebrow">Vencimentos</p>
        <h1>Pessoas e contas</h1>
        <p className="lede">Salários, regras e contas do agregado familiar.</p>
      </div>

      <section className="salary-summary">
        <article className="panel"><p className="eyebrow">Gastos variáveis</p><h2><Money value={dailySpending} /></h2><p>Percentagem do dia-a-dia aplicada aos vencimentos.</p></article>
        <article className="panel"><p className="eyebrow">Subsídios anuais</p><h2><Money value={annualSubsidies} /></h2><p>100% dos subsídios é destinado aos Goals.</p></article>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="settings-section">
        <div className="section-title people-section-title"><div><p className="eyebrow">Pessoas</p><h2>Gerir pessoas</h2></div><button className="secondary-button" onClick={openCreatePerson} disabled={loading}>+ Nova pessoa</button></div>
        {loading ? <p className="form-note">A carregar pessoas…</p> : <div className="person-table-wrap">
          <div className="person-table">
            <div className="person-table-row person-table-header"><span>Pessoa</span><span className="num">Vencimento</span><span className="num">Subsídios</span><span>Ação</span></div>
            {state.configuration.people.map((person) => {
              const income = currentIncome(state.configuration.personIncomes, person.id, referenceMonth);
              const salary = income?.amount ?? 0;
              return <div className="person-table-row" key={person.id}>
                <strong className="person-table-name">{person.name}</strong>
                <span className="num"><Money value={salary} /><small>{income ? `Válido desde ${income.validFrom}` : "Sem histórico salarial"}</small></span>
                <span className="num"><Money value={salary * 2} /><small>2× o vencimento</small></span>
                <button className="entity-edit-button" type="button" title={`Editar ${person.name}`} aria-label={`Editar pessoa ${person.name}`} onClick={() => openEditPerson(person)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                </button>
              </div>;
            })}
          </div>
        </div>}
      </section>

      {personModalOpen && <div className="entity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingPersonId) setPersonModalOpen(false); }}>
        <section className="entity-modal person-modal" role="dialog" aria-modal="true" aria-labelledby="person-modal-title">
          <div className="entity-modal-heading"><div><p className="eyebrow">Pessoas</p><h2 id="person-modal-title">{editingPersonId ? "Editar pessoa" : "Nova pessoa"}</h2></div><button className="entity-modal-close" type="button" aria-label="Fechar" onClick={() => setPersonModalOpen(false)} disabled={savingPersonId !== null}>×</button></div>
          <form onSubmit={(event) => { event.preventDefault(); void savePerson(); }}>
            <label className="entity-modal-field">Nome<input autoFocus required maxLength={100} value={personForm.name} onChange={(event) => setPersonForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <div className="person-modal-settings">
              <label className="entity-modal-field">Gastos variáveis (%)<input type="number" value={personForm.dailySpendingPercentage} onChange={(event) => setPersonForm((current) => ({ ...current, dailySpendingPercentage: Number(event.target.value) }))} /></label>
              <label className="entity-modal-field">Fundo de emergência (meses)<input type="number" value={personForm.emergencyFundMonths} onChange={(event) => setPersonForm((current) => ({ ...current, emergencyFundMonths: Number(event.target.value) }))} /></label>
            </div>
            <p className="form-note fixed-bonus-note">Subsídios fixos para todos: junho e dezembro, no valor do vencimento. Os gastos fixos conjuntos são calculados e não se editam.</p>
            <div className="person-income-heading"><div><p className="eyebrow">Histórico salarial</p><h3>Vencimentos</h3></div><button className="secondary-button" type="button" onClick={addPersonIncomeDraft}>+ Alteração salarial</button></div>
            <div className="person-income-table">
              <div className="person-income-row person-income-header"><span>Vencimento</span><span>Válido desde</span></div>
              {personIncomeForm.map((income, index) => <div className="person-income-row" key={income.id ?? `draft-${index}`}>
                <label>Valor<input type="number" min="0" step="0.01" value={income.amount} onChange={(event) => updatePersonIncomeDraft(index, { amount: Number(event.target.value) })} /></label>
                <label>Data de início<input type="date" required value={income.validFrom} onChange={(event) => updatePersonIncomeDraft(index, { validFrom: event.target.value })} /></label>
              </div>)}
              {!personIncomeForm.length && <p className="form-note">Sem histórico salarial. Adiciona o primeiro vencimento.</p>}
            </div>
            <div className="entity-modal-actions"><button className="secondary-button" type="button" onClick={() => setPersonModalOpen(false)} disabled={savingPersonId !== null}>Cancelar</button><button className="save-button" type="submit" disabled={savingPersonId !== null}>{savingPersonId ? "A guardar…" : "Guardar pessoa"}</button></div>
          </form>
        </section>
      </div>}

      <section className="settings-section">
        <div className="section-title account-section-title"><div><p className="eyebrow">Contas</p><h2>Contas financeiras</h2></div><button className="secondary-button" onClick={openCreateAccount} disabled={loading}>+ Nova conta</button></div>
        {loading ? <p className="form-note">A carregar contas…</p> : <>
          <div className="account-list">{state.configuration.accounts.map((account) => {
            const ownerName = state.configuration.people.find((person) => person.id === account.ownerPersonId)?.name ?? "—";
            return <div className="account-list-row" key={account.id}>
              <span className="account-list-icon" aria-hidden="true">€</span>
              <div className="account-list-details"><strong>{account.name}</strong><span>{ownerName === "—" ? "Conta conjunta · sem proprietário" : `Associada a ${ownerName}`}</span></div>
              <div className="account-list-actions">
                <button className="entity-edit-button" type="button" title={`Editar ${account.name}`} aria-label={`Editar conta ${account.name}`} onClick={() => openEditAccount(account)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg>
                </button>
                <button className="entity-edit-button entity-remove-button" type="button" title={`Remover ${account.name}`} aria-label={`Remover conta ${account.name}`} disabled={removingAccountId === account.id} onClick={() => void removeAccount(account)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></svg>
                </button>
              </div>
            </div>;
          })}</div>
        </>}
      </section>

      {accountModalOpen && <div className="entity-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingAccount) setAccountModalOpen(false); }}>
        <section className="entity-modal" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
          <div className="entity-modal-heading"><div><p className="eyebrow">Contas</p><h2 id="account-modal-title">{editingAccountId ? "Editar conta" : "Nova conta"}</h2></div><button className="entity-modal-close" type="button" aria-label="Fechar" onClick={() => setAccountModalOpen(false)} disabled={savingAccount}>×</button></div>
          <form onSubmit={(event) => { event.preventDefault(); void saveAccount(); }}>
            <label className="entity-modal-field">Nome da conta<input autoFocus required maxLength={100} value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} /></label>
            <label className="entity-modal-field">Pessoa proprietária<select value={accountForm.ownerPersonId ?? ""} onChange={(event) => setAccountForm((current) => ({ ...current, ownerPersonId: event.target.value || null }))}><option value="">Sem proprietário (conta conjunta)</option>{state.configuration.people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
            <div className="entity-modal-actions"><button className="secondary-button" type="button" onClick={() => setAccountModalOpen(false)} disabled={savingAccount}>Cancelar</button><button className="save-button" type="submit" disabled={savingAccount}>{savingAccount ? "A guardar…" : "Guardar conta"}</button></div>
          </form>
        </section>
      </div>}

    </main>
  );
}
