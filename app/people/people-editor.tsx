"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Account, Person } from "@/features/monthly-plan/domain/types";
import { entitiesClient } from "@/shared/lib/entities-client";
import { AppNav } from "@/shared/ui/app-nav";

type AccountDraft = { name: string; ownerPersonId: string | null };

export function PeopleEditor() {
  const [people, setPeople] = useState<Person[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [personNames, setPersonNames] = useState<Record<string, string>>({});
  const [accountDrafts, setAccountDrafts] = useState<Record<string, AccountDraft>>({});
  const [newPersonName, setNewPersonName] = useState("");
  const [newAccount, setNewAccount] = useState<AccountDraft>({ name: "", ownerPersonId: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([entitiesClient.getPeople(), entitiesClient.getAccounts()]).then(([loadedPeople, loadedAccounts]) => {
      if (!active) return;
      setPeople(loadedPeople);
      setAccounts(loadedAccounts);
      setPersonNames(Object.fromEntries(loadedPeople.map((person) => [person.id, person.name])));
      setAccountDrafts(Object.fromEntries(loadedAccounts.map((account) => [account.id, { name: account.name, ownerPersonId: account.ownerPersonId }])));
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Não foi possível carregar pessoas e contas.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function createPerson() {
    setError("");
    try {
      const person = await entitiesClient.createPerson(newPersonName);
      setPeople((current) => [...current, person].sort((a, b) => a.name.localeCompare(b.name)));
      setPersonNames((current) => ({ ...current, [person.id]: person.name }));
      setNewPersonName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a pessoa.");
    }
  }

  async function updatePerson(person: Person) {
    setError("");
    try {
      const updated = await entitiesClient.updatePerson(person.id, personNames[person.id] ?? person.name);
      setPeople((current) => current.map((item) => item.id === person.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
      setPersonNames((current) => ({ ...current, [person.id]: updated.name }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a pessoa.");
    }
  }

  async function createAccount() {
    setError("");
    try {
      const account = await entitiesClient.createAccount(newAccount.name, newAccount.ownerPersonId);
      setAccounts((current) => [...current, account].sort((a, b) => a.name.localeCompare(b.name)));
      setAccountDrafts((current) => ({ ...current, [account.id]: { name: account.name, ownerPersonId: account.ownerPersonId } }));
      setNewAccount({ name: "", ownerPersonId: null });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a conta.");
    }
  }

  async function updateAccount(account: Account) {
    setError("");
    const draft = accountDrafts[account.id] ?? { name: account.name, ownerPersonId: account.ownerPersonId };
    try {
      const updated = await entitiesClient.updateAccount(account.id, draft.name, draft.ownerPersonId);
      setAccounts((current) => current.map((item) => item.id === account.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
      setAccountDrafts((current) => ({ ...current, [account.id]: { name: updated.name, ownerPersonId: updated.ownerPersonId } }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar a conta.");
    }
  }

  function changeAccount(id: string, changes: Partial<AccountDraft>) {
    setAccountDrafts((current) => ({ ...current, [id]: { ...current[id], ...changes } }));
  }

  return (
    <main className="shell compact-shell">
      <AppNav active="people" />
      <div className="page-heading">
        <Link className="back-link" href="/">← Dashboard</Link>
        <p className="eyebrow">Configuração</p>
        <h1>Pessoas e contas</h1>
        <p className="lede">Gere as pessoas e as contas associadas ao agregado familiar.</p>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Pessoas</p><h2>Gerir pessoas</h2></div><span className="settings-status">PostgreSQL</span></div>
        <div className="entity-create-row">
          <label>Nome<input value={newPersonName} onChange={(event) => setNewPersonName(event.target.value)} maxLength={100} /></label>
          <button className="secondary-button" onClick={createPerson} disabled={loading}>+ Adicionar pessoa</button>
        </div>
        {loading ? <p className="form-note">A carregar pessoas…</p> : <div className="entity-list">
          {people.map((person) => (
            <div className="entity-row" key={person.id}>
              <label>Nome<input value={personNames[person.id] ?? person.name} onChange={(event) => setPersonNames((current) => ({ ...current, [person.id]: event.target.value }))} maxLength={100} /></label>
              <button className="secondary-button" onClick={() => updatePerson(person)}>Guardar pessoa</button>
            </div>
          ))}
        </div>}
      </section>

      <section className="settings-section">
        <div className="section-title"><div><p className="eyebrow">Contas</p><h2>Gerir contas</h2></div><span className="settings-status">PostgreSQL</span></div>
        <div className="entity-create-row">
          <label>Nome da conta<input value={newAccount.name} onChange={(event) => setNewAccount((current) => ({ ...current, name: event.target.value }))} maxLength={100} /></label>
          <label>Pessoa proprietária<select value={newAccount.ownerPersonId ?? ""} onChange={(event) => setNewAccount((current) => ({ ...current, ownerPersonId: event.target.value || null }))}><option value="">Sem proprietário</option>{people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
          <button className="secondary-button" onClick={createAccount} disabled={loading}>+ Adicionar conta</button>
        </div>
        {loading ? <p className="form-note">A carregar contas…</p> : <>
          <div className="entity-table-header"><span>Conta</span><span>Pessoa associada</span><span>Ação</span></div>
          <div className="entity-list">
            {accounts.map((account) => {
              const draft = accountDrafts[account.id] ?? { name: account.name, ownerPersonId: account.ownerPersonId };
              const currentOwner = people.find((person) => person.id === account.ownerPersonId)?.name ?? "—";
              return <div className="entity-row account-entity-row" key={account.id}>
                <label>Nome<input value={draft.name} onChange={(event) => changeAccount(account.id, { name: event.target.value })} maxLength={100} /></label>
                <label><span className="entity-current-owner">Atual: {currentOwner}</span><select aria-label={`Pessoa proprietária de ${account.name}`} value={draft.ownerPersonId ?? ""} onChange={(event) => changeAccount(account.id, { ownerPersonId: event.target.value || null })}><option value="">Sem proprietário</option>{people.map((person) => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
                <button className="secondary-button" onClick={() => updateAccount(account)}>Guardar conta</button>
              </div>;
            })}
          </div>
        </>}
      </section>
    </main>
  );
}
