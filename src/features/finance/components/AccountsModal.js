'use client';

import React, { useState } from 'react';
import { Archive, ArchiveRestore, Plus, Trash2, X } from 'lucide-react';
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

const BLANK_DRAFT = {
  name: '',
  type: 'cash',
  currency: 'USD',
  openingBalance: '',
  color: '#94a3b8',
};

export default function AccountsModal({ open, vault, onClose, onChange }) {
  const defaultCurrency = vault?.settings?.defaultCurrency || 'USD';
  const [draft, setDraft] = useState({ ...BLANK_DRAFT, currency: defaultCurrency });

  if (!open) return null;

  const accounts = vault.accounts || [];
  const transactions = vault.transactions || [];

  const resetDraft = () =>
    setDraft({ ...BLANK_DRAFT, currency: defaultCurrency });

  const handleCreate = () => {
    if (!draft.name.trim()) return;
    const newAccount = {
      id: generateId(),
      name: draft.name.trim(),
      type: draft.type,
      currency: draft.currency,
      openingBalance: Number(draft.openingBalance) || 0,
      color: draft.color,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    onChange((data) => ({ ...data, accounts: [...data.accounts, newAccount] }));
    resetDraft();
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
    <div className="tasksModalOverlay" onClick={onClose}>
      <div
        className="tasksModal finAccountsModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tasksModalHeader">
          <h3>Accounts</h3>
          <div className="tasksModalHeaderActions">
            <button
              type="button"
              className="tasksBtn tasksBtnPrimary tasksBtnCompact"
              onClick={handleCreate}
              disabled={!draft.name.trim()}
            >
              <Plus size={14} />
              Add
            </button>
            <button type="button" className="tasksIconBtn" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="tasksTypeCreateGrid finAccountCreateGrid">
          <div className="tasksField">
            <label>Name</label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Checking"
            />
          </div>
          <div className="tasksField finAccountColorField">
            <label>Color</label>
            <ColorPicker
              value={draft.color}
              onChange={(c) => setDraft({ ...draft, color: c })}
            />
          </div>
          <div className="tasksField">
            <label>Type</label>
            <CustomSelect
              options={ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={draft.type}
              onChange={(v) => setDraft({ ...draft, type: v })}
            />
          </div>
          <div className="tasksField">
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
          <div className="tasksField tasksFieldFull">
            <label>Opening balance</label>
            <input
              type="number"
              step="0.01"
              value={draft.openingBalance}
              onChange={(e) => setDraft({ ...draft, openingBalance: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="tasksTypeList finAccountList">
          {accounts.length === 0 ? (
            <p className="tasksMutedText">No accounts yet. Use the form above to add one.</p>
          ) : (
            accounts.map((account) => {
              const balance = computeBalance(account, transactions);
              const typeLabel =
                ACCOUNT_TYPES.find((t) => t.value === account.type)?.label || account.type;
              return (
                <div
                  key={account.id}
                  className={`tasksTypeItem finAccountItem ${account.archived ? 'archived' : ''}`}
                >
                  <div className="tasksTypeInfo finAccountInfo">
                    <ColorPicker
                      value={account.color || '#94a3b8'}
                      onChange={(c) => handleColor(account.id, c)}
                    />
                    <div className="finAccountInfoBody">
                      <input
                        type="text"
                        className="finAccountInlineName"
                        value={account.name}
                        onChange={(e) => handleRename(account.id, e.target.value)}
                      />
                      <p>
                        <span>{typeLabel}</span>
                        <span className="finAccountSep">·</span>
                        <span>{account.currency}</span>
                        <span className="finAccountSep">·</span>
                        <span className={balance < 0 ? 'negative' : ''}>
                          {formatMoney(balance, account.currency)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="finAccountItemActions">
                    <button
                      type="button"
                      className="tasksIconBtn"
                      onClick={() => handleArchive(account.id, !account.archived)}
                      title={account.archived ? 'Restore' : 'Archive'}
                    >
                      {account.archived ? (
                        <ArchiveRestore size={14} />
                      ) : (
                        <Archive size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      className="tasksIconBtn danger"
                      onClick={() => handleDelete(account.id)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
