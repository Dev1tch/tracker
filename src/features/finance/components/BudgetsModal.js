'use client';

import React, { useState } from 'react';
import { Plus, Target, Trash2, Wallet } from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import { generateId } from '@/features/finance/lib/defaults';
import { formatMoney, monthRange } from '@/features/finance/lib/format';

function spentInPeriod(transactions, categoryId, range) {
  return transactions
    .filter(
      (t) =>
        t.type === 'expense' &&
        t.categoryId === categoryId &&
        t.date >= range.start &&
        t.date <= range.end
    )
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
}

const TABS = [
  { value: 'budgets', label: 'Monthly budgets', icon: Wallet },
  { value: 'goals', label: 'Savings goals', icon: Target },
];

export default function BudgetsModal({ open, vault, onClose, onChange }) {
  const [tab, setTab] = useState('budgets');
  const [draftBudget, setDraftBudget] = useState({ categoryId: '', amount: '' });
  const [draftGoal, setDraftGoal] = useState({
    name: '',
    targetAmount: '',
    currentAmount: '',
    targetDate: '',
  });
  const [addingBudget, setAddingBudget] = useState(false);
  const [addingGoal, setAddingGoal] = useState(false);

  if (!open) return null;

  const expenseCategories = (vault.categories || []).filter(
    (c) => c.type === 'expense' && !c.archived
  );
  const transactions = vault.transactions || [];
  const range = monthRange(new Date());
  const currency = vault.settings?.defaultCurrency || 'USD';

  const handleAddBudget = () => {
    if (!draftBudget.categoryId || !draftBudget.amount) return;
    onChange((data) => ({
      ...data,
      budgets: [
        ...data.budgets,
        {
          id: generateId(),
          categoryId: draftBudget.categoryId,
          amount: Number(draftBudget.amount) || 0,
          period: 'month',
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setDraftBudget({ categoryId: '', amount: '' });
    setAddingBudget(false);
  };

  const handleDeleteBudget = (id) => {
    onChange((data) => ({ ...data, budgets: data.budgets.filter((b) => b.id !== id) }));
  };

  const handleAddGoal = () => {
    if (!draftGoal.name.trim() || !draftGoal.targetAmount) return;
    onChange((data) => ({
      ...data,
      goals: [
        ...data.goals,
        {
          id: generateId(),
          name: draftGoal.name.trim(),
          targetAmount: Number(draftGoal.targetAmount) || 0,
          currentAmount: Number(draftGoal.currentAmount) || 0,
          targetDate: draftGoal.targetDate || null,
          createdAt: new Date().toISOString(),
        },
      ],
    }));
    setDraftGoal({ name: '', targetAmount: '', currentAmount: '', targetDate: '' });
    setAddingGoal(false);
  };

  const handleGoalProgress = (id, currentAmount) => {
    onChange((data) => ({
      ...data,
      goals: data.goals.map((g) =>
        g.id === id ? { ...g, currentAmount: Number(currentAmount) || 0 } : g
      ),
    }));
  };

  const handleDeleteGoal = (id) => {
    onChange((data) => ({ ...data, goals: data.goals.filter((g) => g.id !== id) }));
  };

  return (
    <div className="modalOverlay" onClick={onClose}>
      <div
        className="modalContent financeModal financeWideModal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modalHeader">
          <h2 className="modalTitle">Plan</h2>
          <p className="modalDate">Set caps so you notice when a category drifts.</p>
        </div>

        <div className="financeTabRow">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                type="button"
                className={`financeTab ${tab === t.value ? 'active' : ''}`}
                onClick={() => setTab(t.value)}
              >
                <Icon size={12} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === 'budgets' && (
          <>
            <div className="financeManagerList">
              {(vault.budgets || []).length === 0 && (
                <div className="financeManagerEmpty">No budgets yet.</div>
              )}
              {(vault.budgets || []).map((b) => {
                const cat = (vault.categories || []).find((c) => c.id === b.categoryId);
                const spent = spentInPeriod(transactions, b.categoryId, range);
                const pct = Math.min(100, Math.round((spent / (b.amount || 1)) * 100));
                const over = spent > b.amount;
                return (
                  <div key={b.id} className="financeBudgetRow">
                    <div className="financeBudgetHeader">
                      <div className="financeBudgetName">
                        <span
                          className="financeColorDot"
                          style={{ background: cat?.color || '#7f8c8d' }}
                        />
                        {cat?.name || 'Uncategorized'}
                      </div>
                      <div className={`financeBudgetTotals ${over ? 'over' : ''}`}>
                        {formatMoney(spent, currency)} / {formatMoney(b.amount, currency)}
                      </div>
                      <button
                        type="button"
                        className="financeIconBtn danger"
                        onClick={() => handleDeleteBudget(b.id)}
                        title="Remove budget"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="financeBudgetBar">
                      <div
                        className={`financeBudgetFill ${over ? 'over' : ''}`}
                        style={{ width: `${pct}%`, background: cat?.color || 'var(--text-secondary)' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {addingBudget ? (
              <div className="financeInlineForm">
                <h4>New monthly budget</h4>
                <div className="financeFieldGrid">
                  <div className="financeFieldGroup">
                    <label>Category</label>
                    <CustomSelect
                      options={expenseCategories.map((c) => ({
                        value: c.id,
                        label: c.name,
                        color: c.color,
                      }))}
                      value={draftBudget.categoryId}
                      onChange={(v) => setDraftBudget({ ...draftBudget, categoryId: v })}
                      placeholder="Select category"
                    />
                  </div>
                  <div className="financeFieldGroup">
                    <label>Monthly cap</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="authInput"
                      value={draftBudget.amount}
                      onChange={(e) => setDraftBudget({ ...draftBudget, amount: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="modalActions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAddingBudget(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAddBudget}
                    disabled={!draftBudget.categoryId || !draftBudget.amount}
                  >
                    Add budget
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="financeAddRow"
                onClick={() => setAddingBudget(true)}
              >
                <Plus size={14} />
                <span>Add budget</span>
              </button>
            )}
          </>
        )}

        {tab === 'goals' && (
          <>
            <div className="financeManagerList">
              {(vault.goals || []).length === 0 && (
                <div className="financeManagerEmpty">No savings goals yet.</div>
              )}
              {(vault.goals || []).map((g) => {
                const pct = Math.min(
                  100,
                  Math.round(((Number(g.currentAmount) || 0) / (g.targetAmount || 1)) * 100)
                );
                return (
                  <div key={g.id} className="financeBudgetRow">
                    <div className="financeBudgetHeader">
                      <div className="financeBudgetName">{g.name}</div>
                      <div className="financeBudgetTotals">
                        {formatMoney(g.currentAmount, currency)} / {formatMoney(g.targetAmount, currency)}
                      </div>
                      <button
                        type="button"
                        className="financeIconBtn danger"
                        onClick={() => handleDeleteGoal(g.id)}
                        title="Remove goal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="financeBudgetBar">
                      <div
                        className="financeBudgetFill"
                        style={{ width: `${pct}%`, background: 'var(--text-primary)' }}
                      />
                    </div>
                    <div className="financeGoalEditor">
                      <label>Update saved amount</label>
                      <input
                        type="number"
                        step="0.01"
                        className="authInput"
                        value={g.currentAmount ?? ''}
                        onChange={(e) => handleGoalProgress(g.id, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {addingGoal ? (
              <div className="financeInlineForm">
                <h4>New savings goal</h4>
                <div className="financeFieldGroup">
                  <label>Name</label>
                  <input
                    type="text"
                    className="authInput"
                    value={draftGoal.name}
                    onChange={(e) => setDraftGoal({ ...draftGoal, name: e.target.value })}
                    placeholder="e.g. Emergency fund"
                  />
                </div>
                <div className="financeFieldGrid">
                  <div className="financeFieldGroup">
                    <label>Target amount</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="authInput"
                      value={draftGoal.targetAmount}
                      onChange={(e) =>
                        setDraftGoal({ ...draftGoal, targetAmount: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                  <div className="financeFieldGroup">
                    <label>Saved so far</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="authInput"
                      value={draftGoal.currentAmount}
                      onChange={(e) =>
                        setDraftGoal({ ...draftGoal, currentAmount: e.target.value })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="financeFieldGroup">
                  <label>Target date (optional)</label>
                  <input
                    type="date"
                    className="authInput"
                    value={draftGoal.targetDate}
                    onChange={(e) => setDraftGoal({ ...draftGoal, targetDate: e.target.value })}
                  />
                </div>
                <div className="modalActions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setAddingGoal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleAddGoal}
                    disabled={!draftGoal.name.trim() || !draftGoal.targetAmount}
                  >
                    Add goal
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="financeAddRow" onClick={() => setAddingGoal(true)}>
                <Plus size={14} />
                <span>Add savings goal</span>
              </button>
            )}
          </>
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
