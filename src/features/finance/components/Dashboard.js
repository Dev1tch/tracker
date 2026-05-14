'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Repeat,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Wallet,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/ToastProvider';
import {
  formatDayLabel,
  formatMoney,
  formatMonthLabel,
  getYYYYMMDD,
  monthRange,
} from '@/features/finance/lib/format';
import TransactionModal from './TransactionModal';
import AccountsModal from './AccountsModal';
import CategoriesModal from './CategoriesModal';
import BudgetsModal from './BudgetsModal';
import SettingsModal from './SettingsModal';

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function totalsForMonth(transactions, range, currency) {
  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (t.date < range.start || t.date > range.end) return;
    if (t.type === 'income') income += Number(t.amount) || 0;
    else if (t.type === 'expense') expense += Number(t.amount) || 0;
  });
  return { income, expense, net: income - expense, currency };
}

function netWorthByAccount(accounts, transactions) {
  const map = new Map();
  accounts.forEach((a) => map.set(a.id, Number(a.openingBalance) || 0));
  transactions.forEach((t) => {
    const amount = Number(t.amount) || 0;
    if (t.type === 'income' && map.has(t.accountId)) {
      map.set(t.accountId, map.get(t.accountId) + amount);
    } else if (t.type === 'expense' && map.has(t.accountId)) {
      map.set(t.accountId, map.get(t.accountId) - amount);
    } else if (t.type === 'transfer') {
      if (map.has(t.accountId)) map.set(t.accountId, map.get(t.accountId) - amount);
      if (map.has(t.toAccountId)) map.set(t.toAccountId, map.get(t.toAccountId) + amount);
    }
  });
  return map;
}

function categoryBreakdown(transactions, categories, range) {
  const result = new Map();
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    if (t.date < range.start || t.date > range.end) return;
    const id = t.categoryId || 'uncategorized';
    result.set(id, (result.get(id) || 0) + (Number(t.amount) || 0));
  });
  return Array.from(result.entries())
    .map(([id, amount]) => {
      const cat = categories.find((c) => c.id === id);
      return {
        id,
        name: cat?.name || 'Uncategorized',
        color: cat?.color || '#7f8c8d',
        amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

const TYPE_FILTERS = [
  { value: 'all', label: 'All entries' },
  { value: 'expense', label: 'Expenses only' },
  { value: 'income', label: 'Income only' },
  { value: 'transfer', label: 'Transfers only' },
];

export default function Dashboard({ vault, actions, lastSavedAt }) {
  const addToast = useToast();
  const currency = vault.settings?.defaultCurrency || 'USD';

  const [viewDate, setViewDate] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [showAccounts, setShowAccounts] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [showBudgets, setShowBudgets] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const hideBalances = Boolean(vault.settings?.hideBalances);

  useEffect(() => {
    const anyOpen =
      showTransactionModal ||
      showAccounts ||
      showCategories ||
      showBudgets ||
      showSettings ||
      !!transactionToDelete;
    if (anyOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [showTransactionModal, showAccounts, showCategories, showBudgets, showSettings, transactionToDelete]);

  const accounts = useMemo(() => vault.accounts || [], [vault.accounts]);
  const categories = useMemo(() => vault.categories || [], [vault.categories]);
  const transactions = useMemo(() => vault.transactions || [], [vault.transactions]);

  const range = useMemo(() => monthRange(viewDate), [viewDate]);
  const totals = useMemo(
    () => totalsForMonth(transactions, range, currency),
    [transactions, range, currency]
  );
  const balances = useMemo(
    () => netWorthByAccount(accounts, transactions),
    [accounts, transactions]
  );
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, categories, range),
    [transactions, categories, range]
  );
  const breakdownTotal = breakdown.reduce((sum, b) => sum + b.amount, 0);

  const accountById = useMemo(() => {
    const m = new Map();
    accounts.forEach((a) => m.set(a.id, a));
    return m;
  }, [accounts]);
  const categoryById = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  const filteredTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter((t) => t.date >= range.start && t.date <= range.end)
      .filter((t) => (typeFilter === 'all' ? true : t.type === typeFilter))
      .filter((t) =>
        accountFilter === 'all'
          ? true
          : t.accountId === accountFilter || t.toAccountId === accountFilter
      )
      .filter((t) => {
        if (!q) return true;
        const cat = categoryById.get(t.categoryId);
        const acct = accountById.get(t.accountId);
        const haystack = [
          t.payee,
          t.source,
          t.destination,
          t.note,
          cat?.name,
          acct?.name,
          ...(t.tags || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [transactions, range, typeFilter, accountFilter, search, categoryById, accountById]);

  const grouped = useMemo(() => {
    const map = new Map();
    filteredTransactions.forEach((t) => {
      const list = map.get(t.date) || [];
      list.push(t);
      map.set(t.date, list);
    });
    return Array.from(map.entries());
  }, [filteredTransactions]);

  const handleSubmit = async (transaction) => {
    try {
      await actions.updateData((data) => {
        const exists = data.transactions.some((t) => t.id === transaction.id);
        const next = exists
          ? data.transactions.map((t) => (t.id === transaction.id ? transaction : t))
          : [...data.transactions, transaction];
        return { ...data, transactions: next };
      });
      addToast(editing ? 'Transaction updated.' : 'Transaction saved.', 'success');
      setShowTransactionModal(false);
      setEditing(null);
    } catch (err) {
      addToast(err.message || 'Failed to save.', 'error');
    }
  };

  const handleDelete = async () => {
    if (!transactionToDelete) return;
    try {
      await actions.updateData((data) => ({
        ...data,
        transactions: data.transactions.filter((t) => t.id !== transactionToDelete.id),
      }));
      setTransactionToDelete(null);
      setEditing(null);
      setShowTransactionModal(false);
      addToast('Transaction deleted.', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to delete.', 'error');
    }
  };

  const handleToggleBalances = () => {
    actions.updateData((data) => ({
      ...data,
      settings: { ...data.settings, hideBalances: !data.settings?.hideBalances },
    }));
  };

  const handleLock = () => {
    actions.lock();
  };

  const lastBackupAt = vault.settings?.lastBackupAt;
  const dismissedAt = vault.settings?.lastBackupReminderDismissedAt;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const showBackupBanner = useMemo(() => {
    if (transactions.length < 5) return false;
    const dayMs = 24 * 60 * 60 * 1000;
    if (lastBackupAt && now - new Date(lastBackupAt).getTime() < 14 * dayMs) return false;
    if (dismissedAt && now - new Date(dismissedAt).getTime() < 3 * dayMs) return false;
    return true;
  }, [transactions.length, lastBackupAt, dismissedAt, now]);

  const dismissBackupReminder = () => {
    actions.updateData((data) => ({
      ...data,
      settings: {
        ...data.settings,
        lastBackupReminderDismissedAt: new Date().toISOString(),
      },
    }));
  };

  return (
    <div className="financeContainer">
      <div className="financeHeaderBar">
        <div className="financePrivacyBadge" title="Local-only, encrypted vault">
          <ShieldCheck size={12} />
          <span>Local &amp; encrypted</span>
        </div>
        <div className="financeHeaderActions">
          <button
            type="button"
            className="financeIconBtn"
            onClick={handleToggleBalances}
            title={hideBalances ? 'Show balances' : 'Hide balances'}
          >
            {hideBalances ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            type="button"
            className="financeIconBtn"
            onClick={() => setShowAccounts(true)}
            title="Manage accounts"
          >
            <Wallet size={14} />
          </button>
          <button
            type="button"
            className="financeIconBtn"
            onClick={() => setShowCategories(true)}
            title="Manage categories"
          >
            <Tag size={14} />
          </button>
          <button
            type="button"
            className="financeIconBtn"
            onClick={() => setShowBudgets(true)}
            title="Budgets &amp; goals"
          >
            <Cpu size={14} />
          </button>
          <button
            type="button"
            className="financeIconBtn"
            onClick={() => setShowSettings(true)}
            title="Vault settings"
          >
            <Settings size={14} />
          </button>
          <button
            type="button"
            className="financeIconBtn"
            onClick={handleLock}
            title="Lock vault"
          >
            <Lock size={14} />
          </button>
          <button
            type="button"
            className="btn-primary financePrimaryAdd"
            onClick={() => {
              setEditing(null);
              setShowTransactionModal(true);
            }}
          >
            <Plus size={14} style={{ marginRight: 6 }} />
            Transaction
          </button>
        </div>
      </div>

      {showBackupBanner && (
        <div className="financeBackupBanner">
          <div className="financeBackupBannerText">
            <strong>Back up your vault.</strong>
            <span>
              {lastBackupAt
                ? `Last backup ${new Date(lastBackupAt).toLocaleDateString()}. Browser data can be wiped at any time.`
                : "You haven't exported a backup yet. If this browser clears its storage, the vault is gone."}
            </span>
          </div>
          <div className="financeBackupBannerActions">
            <button
              type="button"
              className="btn-secondary"
              onClick={dismissBackupReminder}
            >
              Later
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowSettings(true)}
            >
              Back up now
            </button>
          </div>
        </div>
      )}

      <div className="financeSummaryGrid">
        <div className="financeSummaryCard">
          <div className="financeSummaryLabel">
            <ChevronLeft
              size={14}
              className="financeMonthArrow"
              onClick={() => setViewDate((d) => shiftMonth(d, -1))}
            />
            <span>{formatMonthLabel(viewDate)}</span>
            <ChevronRight
              size={14}
              className="financeMonthArrow"
              onClick={() => setViewDate((d) => shiftMonth(d, 1))}
            />
          </div>
          <div className={`financeSummaryValue ${totals.net < 0 ? 'negative' : 'positive'}`}>
            {formatMoney(totals.net, currency, { signed: true, hidden: hideBalances })}
          </div>
          <div className="financeSummarySubgrid">
            <div className="financeSummarySub">
              <ArrowDownLeft size={12} className="positive" />
              <span>{formatMoney(totals.income, currency, { hidden: hideBalances })}</span>
            </div>
            <div className="financeSummarySub">
              <ArrowUpRight size={12} className="negative" />
              <span>{formatMoney(totals.expense, currency, { hidden: hideBalances })}</span>
            </div>
          </div>
        </div>

        <div className="financeSummaryCard">
          <div className="financeSummaryLabel">
            <span>Accounts</span>
            <button
              type="button"
              className="financeMiniBtn"
              onClick={() => setShowAccounts(true)}
            >
              Manage
            </button>
          </div>
          <div className="financeAccountList">
            {accounts.length === 0 && (
              <div className="financeAccountEmpty">No accounts yet.</div>
            )}
            {accounts.filter((a) => !a.archived).map((a) => {
              const balance = balances.get(a.id) || 0;
              return (
                <div key={a.id} className="financeAccountRow">
                  <span
                    className="financeColorDot"
                    style={{ background: a.color || '#94a3b8' }}
                  />
                  <span className="financeAccountName">{a.name}</span>
                  <span className={`financeAccountBalance ${balance < 0 ? 'negative' : ''}`}>
                    {formatMoney(balance, a.currency, { hidden: hideBalances })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="financeSummaryCard">
          <div className="financeSummaryLabel">
            <span>Where money went</span>
            <span className="financeSummaryHint">{formatMonthLabel(viewDate)}</span>
          </div>
          {breakdown.length === 0 ? (
            <div className="financeAccountEmpty">No expenses this month yet.</div>
          ) : (
            <>
              <div className="financeBreakdownBar">
                {breakdown.map((b) => (
                  <span
                    key={b.id}
                    className="financeBreakdownSegment"
                    style={{
                      width: `${(b.amount / breakdownTotal) * 100}%`,
                      background: b.color,
                    }}
                    title={`${b.name}: ${formatMoney(b.amount, currency)}`}
                  />
                ))}
              </div>
              <div className="financeBreakdownList">
                {breakdown.slice(0, 5).map((b) => (
                  <div key={b.id} className="financeBreakdownRow">
                    <span className="financeColorDot" style={{ background: b.color }} />
                    <span className="financeBreakdownName">{b.name}</span>
                    <span className="financeBreakdownAmount">
                      {formatMoney(b.amount, currency, { hidden: hideBalances })}
                    </span>
                  </div>
                ))}
                {breakdown.length > 5 && (
                  <div className="financeBreakdownMore">+ {breakdown.length - 5} more</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="financeToolbar">
        <div className="financeSearch">
          <Search size={14} />
          <input
            type="text"
            className="authInput"
            placeholder="Search by payee, note, tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="financeFilterWrap">
          <CustomSelect
            options={TYPE_FILTERS}
            value={typeFilter}
            onChange={setTypeFilter}
            placeholder="Type"
          />
        </div>
        <div className="financeFilterWrap">
          <CustomSelect
            options={[
              { value: 'all', label: 'All accounts' },
              ...accounts.map((a) => ({
                value: a.id,
                label: a.name,
                color: a.color,
              })),
            ]}
            value={accountFilter}
            onChange={setAccountFilter}
            placeholder="Account"
          />
        </div>
      </div>

      <div className="financeTransactionList">
        {grouped.length === 0 && (
          <div className="financeEmptyState">
            <p>
              No entries this month yet. Use the <strong>Transaction</strong> button to log your
              first one.
            </p>
            <p className="financeEmptyHint">
              Income, expenses and transfers all stay encrypted on this device.
            </p>
          </div>
        )}
        {grouped.map(([dateStr, items]) => {
          const dayIncome = items
            .filter((t) => t.type === 'income')
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          const dayExpense = items
            .filter((t) => t.type === 'expense')
            .reduce((s, t) => s + (Number(t.amount) || 0), 0);
          return (
            <section key={dateStr} className="financeDayGroup">
              <header className="financeDayHeader">
                <div className="financeDayLabel">{formatDayLabel(dateStr)}</div>
                <div className="financeDayTotals">
                  {dayIncome > 0 && (
                    <span className="positive">
                      +{formatMoney(dayIncome, currency, { hidden: hideBalances })}
                    </span>
                  )}
                  {dayExpense > 0 && (
                    <span className="negative">
                      −{formatMoney(dayExpense, currency, { hidden: hideBalances })}
                    </span>
                  )}
                </div>
              </header>
              <div className="financeDayItems">
                {items.map((t) => {
                  const cat = categoryById.get(t.categoryId);
                  const acct = accountById.get(t.accountId);
                  const toAcct = t.toAccountId ? accountById.get(t.toAccountId) : null;
                  const Icon =
                    t.type === 'income' ? ArrowDownLeft : t.type === 'expense' ? ArrowUpRight : Repeat;
                  return (
                    <button
                      type="button"
                      key={t.id}
                      className={`financeTxnRow ${t.type}`}
                      onClick={() => {
                        setEditing(t);
                        setShowTransactionModal(true);
                      }}
                    >
                      <span
                        className="financeTxnIcon"
                        style={{ background: cat?.color || (t.type === 'transfer' ? 'var(--surface-15)' : 'var(--surface-10)') }}
                      >
                        <Icon size={12} />
                      </span>
                      <div className="financeTxnMain">
                        <div className="financeTxnTitleRow">
                          <span className="financeTxnTitle">
                            {t.type === 'transfer'
                              ? `Transfer → ${toAcct?.name || 'Account'}`
                              : t.payee || cat?.name || 'Untitled'}
                          </span>
                          {t.tags && t.tags.length > 0 && (
                            <span className="financeTxnTags">
                              {t.tags.slice(0, 2).map((tag) => (
                                <span key={tag} className="financeTxnTag">
                                  {tag}
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                        <div className="financeTxnMeta">
                          <span>{acct?.name || 'No account'}</span>
                          {t.type !== 'transfer' && cat && (
                            <>
                              <span>•</span>
                              <span>{cat.name}</span>
                            </>
                          )}
                          {t.source && (
                            <>
                              <span>•</span>
                              <span>from {t.source}</span>
                            </>
                          )}
                          {t.destination && (
                            <>
                              <span>•</span>
                              <span>to {t.destination}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className={`financeTxnAmount ${
                          t.type === 'income' ? 'positive' : t.type === 'expense' ? 'negative' : ''
                        }`}
                      >
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                        {formatMoney(t.amount, t.currency || currency, { hidden: hideBalances })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="financeFooterStrip">
        <div className="financeFooterPledge">
          <Cpu size={11} />
          <span>
            Vault is encrypted with your passphrase and stored only in this browser. No data
            leaves this device.
          </span>
        </div>
        {lastSavedAt && (
          <div className="financeFooterMeta">
            Last saved {new Date(lastSavedAt).toLocaleTimeString()}
          </div>
        )}
      </div>

      {showTransactionModal && (
        <TransactionModal
          key={editing ? editing.id : 'new'}
          open
          initial={editing}
          vault={vault}
          onClose={() => {
            setShowTransactionModal(false);
            setEditing(null);
          }}
          onSubmit={handleSubmit}
          onDelete={editing ? () => setTransactionToDelete(editing) : null}
        />
      )}

      <AccountsModal
        open={showAccounts}
        vault={vault}
        onClose={() => setShowAccounts(false)}
        onChange={(updater) => actions.updateData(updater)}
      />
      <CategoriesModal
        open={showCategories}
        vault={vault}
        onClose={() => setShowCategories(false)}
        onChange={(updater) => actions.updateData(updater)}
      />
      <BudgetsModal
        open={showBudgets}
        vault={vault}
        onClose={() => setShowBudgets(false)}
        onChange={(updater) => actions.updateData(updater)}
      />
      <SettingsModal
        open={showSettings}
        vault={vault}
        actions={actions}
        onClose={() => setShowSettings(false)}
      />

      <ConfirmModal
        isOpen={!!transactionToDelete}
        title="Delete transaction"
        message="This entry will be removed from the vault. This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={() => setTransactionToDelete(null)}
      />
    </div>
  );
}
