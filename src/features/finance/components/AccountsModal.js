'use client';

import React, { useState } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2 } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import ColorPicker from '@/components/ui/ColorPicker';
import {
  ACCOUNT_TYPES,
  CURRENCY_OPTIONS,
  generateId,
  currencyToSelectOption,
} from '@/features/finance/lib/defaults';
import { formatMoney } from '@/features/finance/lib/format';

function computeBalance(account, transactions) {
  let balance = Number(account.openingBalance) || 0;
  for (const t of transactions) {
    if (t.type === 'income' && t.accountId === account.id) balance += Number(t.amount) || 0;
    else if (t.type === 'expense' && t.accountId === account.id) balance -= Number(t.amount) || 0;
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) balance -= Number(t.amount) || 0;
      if (t.toAccountId === account.id) balance += Number(t.amount) || 0;
    }
  }
  return balance;
}

export default function AccountsModal({ open, vault, onClose, onChange }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    type: 'cash',
    currency: vault?.settings?.defaultCurrency || 'USD',
    openingBalance: '',
    color: '#94a3b8',
    note: '',
  });

  if (!open) return null;

  const accounts = vault.accounts || [];
  const transactions = vault.transactions || [];

  const handleCreate = () => {
    if (!draft.name.trim()) return;
    const newAccount = {
      id: generateId(),
      name: draft.name.trim(),
      type: draft.type,
      currency: draft.currency,
      openingBalance: Number(draft.openingBalance) || 0,
      color: draft.color,
      note: draft.note.trim(),
      archived: false,
      createdAt: new Date().toISOString(),
    };
    onChange((data) => ({ ...data, accounts: [...data.accounts, newAccount] }));
    setDraft({
      name: '',
      type: 'cash',
      currency: vault?.settings?.defaultCurrency || 'USD',
      openingBalance: '',
      color: '#94a3b8',
      note: '',
    });
    setAdding(false);
  };

  const handleArchive = (id, archived) => {
    onChange((data) => ({
      ...data,
      accounts: data.accounts.map((a) => (a.id === id ? { ...a, archived } : a)),
    }));
  };

  const handleRename = (id, name) => {
    onChange((data) => ({
      ...data,
      accounts: data.accounts.map((a) => (a.id === id ? { ...a, name } : a)),
    }));
  };

  const handleColor = (id, color) => {
    onChange((data) => ({
      ...data,
      accounts: data.accounts.map((a) => (a.id === id ? { ...a, color } : a)),
    }));
  };

  const handleDelete = (id) => {
    const inUse = transactions.some((t) => t.accountId === id || t.toAccountId === id);
    if (inUse) {
      const ok = window.confirm(
        'This account is referenced by transactions. Deleting it will leave those entries without an account. Continue?'
      );
      if (!ok) return;
    }
    onChange((data) => ({
      ...data,
      accounts: data.accounts.filter((a) => a.id !== id),
    }));
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalContent financeModal financeWideModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <h2 className="modalTitle">Accounts</h2>
          <p className="modalDate">Cash, bank, cards or anything you want to track separately.</p>
        </div>

        <div className="financeManagerList">
          {accounts.map((account) => {
            const balance = computeBalance(account, transactions);
            return (
              <div key={account.id} className={`financeManagerRow ${account.archived ? 'archived' : ''}`}>
                <div className="financeManagerColorWrap">
                  <ColorPicker
                    value={account.color || '#94a3b8'}
                    onChange={(c) => handleColor(account.id, c)}
                  />
                </div>
                <div className="financeManagerMain">
                  <input
                    type="text"
                    className="financeInlineInput"
                    value={account.name}
                    onChange={(e) => handleRename(account.id, e.target.value)}
                  />
                  <div className="financeManagerMeta">
                    <span>{ACCOUNT_TYPES.find((t) => t.value === account.type)?.label || account.type}</span>
                    <span>•</span>
                    <span>{account.currency}</span>
                    <span>•</span>
                    <span className={balance < 0 ? 'negative' : ''}>{formatMoney(balance, account.currency)}</span>
                  </div>
                </div>
                <div className="financeManagerActions">
                  <button
                    type="button"
                    className="financeIconBtn"
                    onClick={() => handleArchive(account.id, !account.archived)}
                    title={account.archived ? 'Restore' : 'Archive'}
                  >
                    {account.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                  <button
                    type="button"
                    className="financeIconBtn danger"
                    onClick={() => handleDelete(account.id)}
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className="financeInlineForm">
            <h4>New account</h4>
            <div className="financeFieldGrid">
              <div className="financeFieldGroup">
                <label>Name</label>
                <input
                  className="authInput"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="e.g. Checking"
                />
              </div>
              <div className="financeFieldGroup">
                <label>Type</label>
                <CustomSelect
                  options={ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                  value={draft.type}
                  onChange={(v) => setDraft({ ...draft, type: v })}
                />
              </div>
            </div>
            <div className="financeFieldGrid">
              <div className="financeFieldGroup">
                <label>Currency</label>
                <CustomSelect
                  options={CURRENCY_OPTIONS.map((currency) =>
                    currencyToSelectOption(currency, { includeName: false })
                  )}
                  value={draft.currency}
                  onChange={(v) => setDraft({ ...draft, currency: v })}
                  searchable
                  searchPlaceholder="Search by code or name"
                />
              </div>
              <div className="financeFieldGroup">
                <label>Opening balance</label>
                <input
                  type="number"
                  step="0.01"
                  className="authInput"
                  value={draft.openingBalance}
                  onChange={(e) => setDraft({ ...draft, openingBalance: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="financeFieldGroup">
              <label>Color</label>
              <ColorPicker
                value={draft.color}
                onChange={(c) => setDraft({ ...draft, color: c })}
              />
            </div>
            <div className="modalActions" style={{ marginTop: 16 }}>
              <button type="button" className="btn-secondary" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCreate}
                disabled={!draft.name.trim()}
              >
                Add account
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="financeAddRow" onClick={() => setAdding(true)}>
            <Plus size={14} />
            <span>Add account</span>
          </button>
        )}

        <div className="modalActions" style={{ marginTop: 24 }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
