'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  EyeOff,
  Layers,
  Lock,
  Plus,
  Repeat,
  Settings2,
  Tag,
  Target,
} from 'lucide-react';
import CustomSelect from '@/components/ui/CustomSelect';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useToast } from '@/components/ui/ToastProvider';
import {
  formatDayLabel,
  formatMoney,
  formatMonthLabel,
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

function totalsForMonth(transactions, range) {
  let income = 0;
  let expense = 0;
  transactions.forEach((t) => {
    if (t.date < range.start || t.date > range.end) return;
    if (t.type === 'income') income += Number(t.amount) || 0;
    else if (t.type === 'expense') expense += Number(t.amount) || 0;
  });
  return { income, expense, net: income - expense };
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

function spentByCategoryInRange(transactions, range) {
  const map = new Map();
  transactions.forEach((t) => {
    if (t.type !== 'expense') return;
    if (t.date < range.start || t.date > range.end) return;
    map.set(t.categoryId, (map.get(t.categoryId) || 0) + (Number(t.amount) || 0));
  });
  return map;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

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

  useEffect(() => {
    if (!settingsOpen) return undefined;
    function handle(event) {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [settingsOpen]);

  const accounts = useMemo(() => vault.accounts || [], [vault.accounts]);
  const categories = useMemo(() => vault.categories || [], [vault.categories]);
  const transactions = useMemo(() => vault.transactions || [], [vault.transactions]);

  const range = useMemo(() => monthRange(viewDate), [viewDate]);
  const totals = useMemo(() => totalsForMonth(transactions, range), [transactions, range]);
  const balances = useMemo(
    () => netWorthByAccount(accounts, transactions),
    [accounts, transactions]
  );
  const totalBalance = useMemo(() => {
    let sum = 0;
    accounts.forEach((a) => {
      if (a.archived) return;
      sum += balances.get(a.id) || 0;
    });
    return sum;
  }, [accounts, balances]);
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, categories, range),
    [transactions, categories, range]
  );
  const breakdownTotal = breakdown.reduce((sum, b) => sum + b.amount, 0);
  const spentByCat = useMemo(
    () => spentByCategoryInRange(transactions, range),
    [transactions, range]
  );

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
    setSettingsOpen(false);
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

  const closePopover = (fn) => () => {
    setSettingsOpen(false);
    fn();
  };

  const today = new Date();
  const isCurrentMonth =
    viewDate.getMonth() === today.getMonth() &&
    viewDate.getFullYear() === today.getFullYear();

  const activeAccounts = accounts.filter((a) => !a.archived);

  return (
    <div className="calContainer finShell">
      <header className="calHeader finHeader">
        <div className="calHeaderLeft finHeaderLeft">
          <h1 className="calTitle finHeaderDate">
            {formatMonthLabel(viewDate)}
          </h1>
        </div>

        <div className="calHeaderRight finHeaderRight">
          <input
            type="text"
            className="authInput finHeaderSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payee, note, tag"
          />

          <div className="finHeaderFilter">
            <CustomSelect
              options={TYPE_FILTERS}
              value={typeFilter}
              onChange={setTypeFilter}
              placeholder="All entries"
            />
          </div>

          <div className="finHeaderFilter">
            <CustomSelect
              options={[
                { value: 'all', label: 'All accounts' },
                ...activeAccounts.map((a) => ({
                  value: a.id,
                  label: a.name,
                  color: a.color,
                })),
              ]}
              value={accountFilter}
              onChange={setAccountFilter}
              placeholder="All accounts"
            />
          </div>

          <button
            type="button"
            className="calTodayBtn"
            onClick={() => setViewDate(startOfMonth(new Date()))}
            disabled={isCurrentMonth}
          >
            This Month
          </button>

          <div className="calNavButtons">
            <button
              type="button"
              className="calNavBtn"
              onClick={() => setViewDate((d) => shiftMonth(d, -1))}
              title="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="calNavBtn"
              onClick={() => setViewDate((d) => shiftMonth(d, 1))}
              title="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            type="button"
            className="calBookBtn"
            onClick={() => {
              setEditing(null);
              setShowTransactionModal(true);
            }}
          >
            <Plus size={16} />
            <span>Transaction</span>
          </button>

          <div className="calSettingsWrap" ref={settingsRef}>
            <button
              type="button"
              className="calNavBtn"
              onClick={() => setSettingsOpen((v) => !v)}
              title="Vault menu"
            >
              <Settings2 size={16} />
            </button>
            {settingsOpen && (
              <div className="calSettingsPopover finSettingsPopover">
                <button
                  type="button"
                  className="finPopoverItem"
                  onClick={closePopover(() => setShowCategories(true))}
                >
                  <Tag size={13} />
                  <span>Manage categories</span>
                </button>
                <button
                  type="button"
                  className="finPopoverItem"
                  onClick={closePopover(() => setShowBudgets(true))}
                >
                  <Target size={13} />
                  <span>Budgets &amp; goals</span>
                </button>
                <button
                  type="button"
                  className="finPopoverItem"
                  onClick={closePopover(() => setShowSettings(true))}
                >
                  <Cpu size={13} />
                  <span>Vault settings</span>
                </button>
                <div className="finPopoverDivider" />
                <button
                  type="button"
                  className="finPopoverItem danger"
                  onClick={handleLock}
                >
                  <Lock size={13} />
                  <span>Lock vault</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showBackupBanner && (
        <div className="finBackupStrip">
          <div className="finBackupText">
            <strong>Back up your vault.</strong>
            <span>
              {lastBackupAt
                ? `Last backup ${new Date(lastBackupAt).toLocaleDateString()}. Browser data can be wiped at any time.`
                : "You haven't exported a backup yet. If this browser clears its storage, the vault is gone."}
            </span>
          </div>
          <div className="finBackupActions">
            <button
              type="button"
              className="calTodayBtn"
              onClick={dismissBackupReminder}
            >
              Later
            </button>
            <button
              type="button"
              className="calBookBtn"
              onClick={() => setShowSettings(true)}
            >
              Back up now
            </button>
          </div>
        </div>
      )}

      <div className="calLayout finLayout">
        <aside className="calSidebar finSidebar">
          <section className="finSideSection">
            <header className="finSideHead">
              <span>Month</span>
              <span className="finSideSub">{formatMonthLabel(viewDate)}</span>
            </header>
            <div className="finNetRow">
              <div className={`finNet ${totals.net < 0 ? 'negative' : 'positive'}`}>
                {formatMoney(totals.net, currency, { signed: true, hidden: hideBalances })}
              </div>
              <button
                type="button"
                className="finEyeBtn"
                onClick={handleToggleBalances}
                title={hideBalances ? 'Show balances' : 'Hide balances'}
                aria-label={hideBalances ? 'Show balances' : 'Hide balances'}
              >
                {hideBalances ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="finFlow">
              <div className="finFlowItem">
                <span className="finFlowLabel">
                  <ArrowDownLeft size={11} />
                  <span>Income</span>
                </span>
                <span className="finFlowVal positive">
                  {formatMoney(totals.income, currency, { hidden: hideBalances })}
                </span>
              </div>
              <div className="finFlowItem">
                <span className="finFlowLabel">
                  <ArrowUpRight size={11} />
                  <span>Expense</span>
                </span>
                <span className="finFlowVal negative">
                  {formatMoney(totals.expense, currency, { hidden: hideBalances })}
                </span>
              </div>
            </div>
          </section>

          <section className="finSideSection">
            <header className="finSideHead">
              <span>Accounts</span>
              <button
                type="button"
                className="finSideAddBtn"
                onClick={() => setShowAccounts(true)}
                title="Add account"
                aria-label="Add account"
              >
                <Plus size={13} />
              </button>
            </header>
            <div className="finAccountList">
              <button
                type="button"
                className={`finAccountRow ${accountFilter === 'all' ? 'active' : ''}`}
                onClick={() => setAccountFilter('all')}
              >
                <span
                  className="finAccountDot"
                  style={{ background: 'var(--surface-35)' }}
                />
                <span className="finAccountName">All accounts</span>
                <span className="finAccountBalance">
                  {formatMoney(totalBalance, currency, { hidden: hideBalances })}
                </span>
              </button>
              {activeAccounts.length === 0 && (
                <div className="finSideEmpty">No accounts yet.</div>
              )}
              {activeAccounts.map((a) => {
                const balance = balances.get(a.id) || 0;
                const active = accountFilter === a.id;
                return (
                  <button
                    type="button"
                    key={a.id}
                    className={`finAccountRow ${active ? 'active' : ''}`}
                    onClick={() =>
                      setAccountFilter((prev) => (prev === a.id ? 'all' : a.id))
                    }
                    style={{ '--row-color': a.color || 'var(--text-tertiary)' }}
                  >
                    <span
                      className="finAccountDot"
                      style={{ background: a.color || 'var(--text-tertiary)' }}
                    />
                    <span className="finAccountName">{a.name}</span>
                    <span
                      className={`finAccountBalance ${balance < 0 ? 'negative' : ''}`}
                    >
                      {formatMoney(balance, a.currency, { hidden: hideBalances })}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {(vault.budgets || []).length > 0 && (
            <section className="finSideSection">
              <header className="finSideHead">
                <span>Budgets</span>
                <button
                  type="button"
                  className="finSideAction"
                  onClick={() => setShowBudgets(true)}
                >
                  All
                </button>
              </header>
              <div className="finBudgetMiniList">
                {(vault.budgets || []).slice(0, 3).map((b) => {
                  const cat = categoryById.get(b.categoryId);
                  const spent = spentByCat.get(b.categoryId) || 0;
                  const pct = Math.min(
                    100,
                    Math.round((spent / (b.amount || 1)) * 100)
                  );
                  const over = spent > b.amount;
                  const color = cat?.color || 'var(--text-secondary)';
                  return (
                    <div key={b.id} className="finBudgetMini">
                      <div className="finBudgetMiniRow">
                        <span className="finBudgetMiniName">
                          <span
                            className="finAccountDot"
                            style={{ background: color }}
                          />
                          <span>{cat?.name || 'Uncategorized'}</span>
                        </span>
                        <span
                          className={`finBudgetMiniPct ${over ? 'negative' : ''}`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="finBudgetMiniBar">
                        <div
                          className={`finBudgetMiniFill ${over ? 'over' : ''}`}
                          style={{ width: `${pct}%`, background: color }}
                        />
                      </div>
                      <div className="finBudgetMiniMeta">
                        {formatMoney(spent, currency, { hidden: hideBalances })} of{' '}
                        {formatMoney(b.amount, currency, { hidden: hideBalances })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="finSideSection finSidePledge">
            <span>
              <Cpu size={11} />
              Encrypted with your passphrase. Nothing leaves this device.
            </span>
            {lastSavedAt && (
              <span className="finSideSavedAt">
                Saved {new Date(lastSavedAt).toLocaleTimeString()}
              </span>
            )}
          </section>
        </aside>

        <main className="calMain finMain">
          {breakdown.length > 0 && (
            <section className="finBreakdown">
              <header className="finBreakdownHead">
                <span>Where money went</span>
                <span className="finBreakdownTotal">
                  {formatMoney(breakdownTotal, currency, { hidden: hideBalances })}
                </span>
              </header>
              <div className="finBreakdownBar">
                {breakdown.map((b) => (
                  <span
                    key={b.id}
                    className="finBreakdownSegment"
                    style={{
                      width: `${(b.amount / breakdownTotal) * 100}%`,
                      background: b.color,
                    }}
                    title={`${b.name}: ${formatMoney(b.amount, currency)}`}
                  />
                ))}
              </div>
              <div className="finBreakdownLegend">
                {breakdown.slice(0, 6).map((b) => (
                  <div key={b.id} className="finBreakdownChip">
                    <span
                      className="finBreakdownDot"
                      style={{ background: b.color }}
                    />
                    <span className="finBreakdownName">{b.name}</span>
                    <span className="finBreakdownAmount">
                      {formatMoney(b.amount, currency, { hidden: hideBalances })}
                    </span>
                  </div>
                ))}
                {breakdown.length > 6 && (
                  <div className="finBreakdownChip muted">
                    + {breakdown.length - 6} more
                  </div>
                )}
              </div>
            </section>
          )}

          {grouped.length === 0 ? (
            <div className="finEmpty">
              <Layers size={32} strokeWidth={1.2} />
              <h3>No entries this month</h3>
              <p>
                Use the <strong>Transaction</strong> button to log your first one.
              </p>
              <p className="finEmptyHint">
                Income, expenses and transfers all stay encrypted on this device.
              </p>
            </div>
          ) : (
            <div className="finTxnList">
              {grouped.map(([dateStr, items]) => {
                const dayIncome = items
                  .filter((t) => t.type === 'income')
                  .reduce((s, t) => s + (Number(t.amount) || 0), 0);
                const dayExpense = items
                  .filter((t) => t.type === 'expense')
                  .reduce((s, t) => s + (Number(t.amount) || 0), 0);
                return (
                  <section key={dateStr} className="finDayGroup">
                    <header className="finDayHead">
                      <span className="finDayLabel">
                        {formatDayLabel(dateStr)}
                      </span>
                      <div className="finDayTotals">
                        {dayIncome > 0 && (
                          <span className="positive">
                            +
                            {formatMoney(dayIncome, currency, {
                              hidden: hideBalances,
                            })}
                          </span>
                        )}
                        {dayExpense > 0 && (
                          <span className="negative">
                            −
                            {formatMoney(dayExpense, currency, {
                              hidden: hideBalances,
                            })}
                          </span>
                        )}
                      </div>
                    </header>
                    <div className="finDayItems">
                      {items.map((t) => {
                        const cat = categoryById.get(t.categoryId);
                        const acct = accountById.get(t.accountId);
                        const toAcct = t.toAccountId
                          ? accountById.get(t.toAccountId)
                          : null;
                        const Icon =
                          t.type === 'income'
                            ? ArrowDownLeft
                            : t.type === 'expense'
                              ? ArrowUpRight
                              : Repeat;
                        return (
                          <button
                            type="button"
                            key={t.id}
                            className={`finTxnRow ${t.type}`}
                            onClick={() => {
                              setEditing(t);
                              setShowTransactionModal(true);
                            }}
                          >
                            <span
                              className="finTxnIcon"
                              style={{
                                background:
                                  cat?.color ||
                                  (t.type === 'transfer'
                                    ? 'var(--surface-15)'
                                    : 'var(--surface-10)'),
                              }}
                            >
                              <Icon size={12} />
                            </span>
                            <div className="finTxnMain">
                              <div className="finTxnTitleRow">
                                <span className="finTxnTitle">
                                  {t.type === 'transfer'
                                    ? `Transfer → ${toAcct?.name || 'Account'}`
                                    : t.payee || cat?.name || 'Untitled'}
                                </span>
                                {t.tags && t.tags.length > 0 && (
                                  <span className="finTxnTags">
                                    {t.tags.slice(0, 2).map((tag) => (
                                      <span key={tag} className="finTxnTag">
                                        {tag}
                                      </span>
                                    ))}
                                  </span>
                                )}
                              </div>
                              <div className="finTxnMeta">
                                <span>{acct?.name || 'No account'}</span>
                                {t.type !== 'transfer' && cat && (
                                  <>
                                    <span>•</span>
                                    <span>{cat.name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div
                              className={`finTxnAmount ${
                                t.type === 'income'
                                  ? 'positive'
                                  : t.type === 'expense'
                                    ? 'negative'
                                    : ''
                              }`}
                            >
                              {t.type === 'income'
                                ? '+'
                                : t.type === 'expense'
                                  ? '−'
                                  : ''}
                              {formatMoney(t.amount, t.currency || currency, {
                                hidden: hideBalances,
                              })}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
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
