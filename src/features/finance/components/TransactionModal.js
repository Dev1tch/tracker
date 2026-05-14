'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Repeat } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import TasksDatePicker from '@/features/tasks/components/TasksBoard/components/TasksDatePicker';
import {
  PAYMENT_METHODS,
  TRANSACTION_TYPES,
  generateId,
} from '@/features/finance/lib/defaults';
import { getYYYYMMDD } from '@/features/finance/lib/format';

const TYPE_ICONS = {
  expense: <ArrowUpRight size={14} />,
  income: <ArrowDownLeft size={14} />,
  transfer: <Repeat size={14} />,
};

function blankTransaction(overrides = {}) {
  return {
    id: generateId(),
    type: 'expense',
    amount: '',
    currency: '',
    accountId: '',
    toAccountId: '',
    categoryId: '',
    date: getYYYYMMDD(new Date()),
    payee: '',
    paymentMethod: 'cash',
    note: '',
    tags: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export default function TransactionModal({
  open,
  initial,
  vault,
  onClose,
  onSubmit,
  onDelete,
}) {
  const accounts = useMemo(
    () => (vault?.accounts || []).filter((a) => !a.archived),
    [vault]
  );
  const categories = vault?.categories || [];
  const defaultCurrency = vault?.settings?.defaultCurrency;

  const [form, setForm] = useState(() =>
    initial
      ? { ...blankTransaction(), ...initial, amount: String(initial.amount ?? '') }
      : blankTransaction({
          accountId: accounts[0]?.id || '',
          currency: accounts[0]?.currency || defaultCurrency || 'USD',
        })
  );
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');

  if (!open) return null;

  const isTransfer = form.type === 'transfer';
  const filteredCategories = categories.filter(
    (c) => !c.archived && (form.type === 'transfer' ? false : c.type === form.type)
  );

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'accountId') {
        const acct = accounts.find((a) => a.id === value);
        if (acct) next.currency = acct.currency;
      }
      if (field === 'type' && value === 'transfer') {
        next.categoryId = '';
      }
      if (field === 'type' && value !== 'transfer') {
        next.toAccountId = '';
      }
      return next;
    });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    if (form.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    setTagInput('');
  };

  const handleRemoveTag = (tag) => {
    setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!form.accountId) {
      setError('Pick an account.');
      return;
    }
    if (isTransfer) {
      if (!form.toAccountId) {
        setError('Pick a destination account.');
        return;
      }
      if (form.toAccountId === form.accountId) {
        setError('Source and destination must be different accounts.');
        return;
      }
    } else if (!form.categoryId) {
      setError('Pick a category (or create one).');
      return;
    }
    onSubmit({
      ...form,
      amount,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalContent financeModal financeTxnModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <h2 className="modalTitle">
            {initial ? 'Edit transaction' : 'New transaction'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="financeTxnForm">
          <div className="financeTypeRow">
            {TRANSACTION_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`financeTypePill ${form.type === opt.value ? 'active' : ''} ${opt.value}`}
                onClick={() => updateField('type', opt.value)}
              >
                {TYPE_ICONS[opt.value]}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {isTransfer ? (
            <>
              <div className="financeFieldGrid">
                <div className="financeFieldGroup">
                  <label>Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="authInput"
                    value={form.amount}
                    onChange={(e) => updateField('amount', e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div className="financeFieldGroup">
                  <label>Date</label>
                  <TasksDatePicker
                    value={form.date}
                    onChange={(v) => updateField('date', v || getYYYYMMDD(new Date()))}
                    placeholder="Pick date"
                  />
                </div>
              </div>

              <div className="financeFieldGrid">
                <div className="financeFieldGroup">
                  <label>From account</label>
                  <CustomSelect
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.currency})`,
                      color: a.color,
                    }))}
                    value={form.accountId}
                    onChange={(v) => updateField('accountId', v)}
                    placeholder="Select account"
                  />
                </div>
                <div className="financeFieldGroup">
                  <label>To account</label>
                  <CustomSelect
                    options={accounts
                      .filter((a) => a.id !== form.accountId)
                      .map((a) => ({
                        value: a.id,
                        label: `${a.name} (${a.currency})`,
                        color: a.color,
                      }))}
                    value={form.toAccountId}
                    onChange={(v) => updateField('toAccountId', v)}
                    placeholder="Destination account"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="financeFieldGrid3">
                <div className="financeFieldGroup">
                  <label>Amount</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="authInput"
                    value={form.amount}
                    onChange={(e) => updateField('amount', e.target.value)}
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div className="financeFieldGroup">
                  <label>Date</label>
                  <TasksDatePicker
                    value={form.date}
                    onChange={(v) => updateField('date', v || getYYYYMMDD(new Date()))}
                    placeholder="Pick date"
                  />
                </div>
                <div className="financeFieldGroup">
                  <label>Account</label>
                  <CustomSelect
                    options={accounts.map((a) => ({
                      value: a.id,
                      label: `${a.name} (${a.currency})`,
                      color: a.color,
                    }))}
                    value={form.accountId}
                    onChange={(v) => updateField('accountId', v)}
                    placeholder="Select account"
                  />
                </div>
              </div>

              <div className="financeFieldGrid3">
                <div className="financeFieldGroup">
                  <label>Category</label>
                  <CustomSelect
                    options={filteredCategories.map((c) => ({
                      value: c.id,
                      label: c.name,
                      color: c.color,
                    }))}
                    value={form.categoryId}
                    onChange={(v) => updateField('categoryId', v)}
                    placeholder={`Select ${form.type} category`}
                  />
                </div>
                <div className="financeFieldGroup">
                  <label>Method</label>
                  <CustomSelect
                    options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
                    value={form.paymentMethod}
                    onChange={(v) => updateField('paymentMethod', v)}
                    placeholder="Payment method"
                  />
                </div>
                <div className="financeFieldGroup">
                  <label>{form.type === 'income' ? 'From (payer)' : 'Payee / store'}</label>
                  <input
                    type="text"
                    className="authInput"
                    value={form.payee}
                    onChange={(e) => updateField('payee', e.target.value)}
                    placeholder={form.type === 'income' ? 'Employer, client...' : 'Where you spent'}
                  />
                </div>
              </div>
            </>
          )}

          <div className="financeTxnFooterGrid">
            <div className="financeFieldGroup">
              <label>Tags</label>
              <div className="financeTagInputRow">
                <input
                  type="text"
                  className="authInput"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tag and press Enter"
                />
                <button type="button" className="btn-secondary" onClick={handleAddTag}>
                  Add
                </button>
              </div>
              {form.tags.length > 0 && (
                <div className="financeTagList">
                  {form.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="financeTagChip"
                      onClick={() => handleRemoveTag(tag)}
                      title="Remove"
                    >
                      {tag} <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="financeFieldGroup">
              <label>Note</label>
              <textarea
                className="commentInput financeTxnNote"
                value={form.note}
                onChange={(e) => updateField('note', e.target.value)}
                placeholder="Optional details..."
              />
            </div>
          </div>

          {error && <div className="authError" style={{ marginTop: 0 }}>{error}</div>}

          <div className="modalActions financeTxnActions">
            {initial && onDelete && (
              <button
                type="button"
                className="btn-secondary financeDeleteBtn"
                onClick={onDelete}
              >
                Delete
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {initial ? 'Save changes' : 'Save transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
