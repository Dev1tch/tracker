import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Eye,
  EyeOff,
  Lock,
  Settings2,
  Trash2,
} from 'lucide-react-native';

import ActionButton from '../../components/ActionButton';
import ColorField from '../../components/ColorField';
import DateTimeField from '../../components/DateTimeField';
import InlinePickerField from '../../components/InlinePickerField';
import LoadingScreen from '../../components/LoadingScreen';
import ModalSheet from '../../components/ModalSheet';
import OptionPickerSheet from '../../components/OptionPickerSheet';
import ScreenShell from '../../components/ScreenShell';
import SectionCard from '../../components/SectionCard';
import TextField from '../../components/TextField';
import { useVaultContext } from './hooks/useVault';
import {
  ACCOUNT_TYPES,
  CURRENCY_OPTIONS,
  DEFAULT_CURRENCY,
  generateId,
} from '../../../../src/features/finance/lib/defaults';
import {
  dateInRange,
  formatDayLabel,
  formatMoney,
  formatMonthLabel,
  getCurrencyMeta,
  getYYYYMMDD,
  monthRange,
} from '../../../../src/features/finance/lib/format';
import { useTheme } from '../../theme';
import { useToast } from '../../providers/ToastProvider';
import { useDialog } from '../../providers/DialogProvider';

const COLOR_PRESETS = [
  '#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#f87171',
  '#a78bfa', '#fb7185', '#2dd4bf', '#f97316', '#e879f9',
];
const TRANSACTION_TYPE_TABS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

function accountBalance(account, transactions) {
  let balance = Number(account.openingBalance) || 0;
  transactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    if (tx.type === 'transfer') {
      if (tx.accountId === account.id) balance -= amount;
      if (tx.toAccountId === account.id) balance += amount;
    } else if (tx.accountId === account.id) {
      balance += tx.type === 'income' ? amount : -amount;
    }
  });
  return balance;
}

function Segmented({ options, value, onChange }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentedTab, active ? styles.segmentedTabActive : null]}
          >
            <Text style={[styles.segmentedLabel, active ? styles.segmentedLabelActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function GateForm({ mode, error, onSubmit }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { alert } = useDialog();
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const currencyOptions = useMemo(
    () => CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} — ${item.label}` })),
    []
  );
  const currencyLabel = useMemo(
    () => CURRENCY_OPTIONS.find((item) => item.code === currency)?.label || currency,
    [currency]
  );

  const submit = async () => {
    if (busy) return;
    if (mode === 'create' && passphrase !== confirm) {
      alert({ message: 'Passphrases do not match.' });
      return;
    }
    setBusy(true);
    // Real macrotask yield so React commits the busy render and the native spinner
    // mounts + paints BEFORE the (thread-heavy) key derivation starts. @noble's
    // async PBKDF2 only yields to microtasks, which never lets RN paint a frame.
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      await onSubmit({ passphrase, currency });
    } catch {
      // error surfaced by the caller via the `error` prop
    } finally {
      setBusy(false);
    }
  };

  if (busy) {
    return (
      <SectionCard>
        <View style={styles.gateLoading}>
          <ActivityIndicator color={theme.colors.accent} size="large" />
          <Text style={styles.gateLoadingTitle}>
            {mode === 'create' ? 'Creating your vault' : 'Unlocking'}
          </Text>
          <Text style={styles.gateLoadingHint}>
            Encrypting your data on this device — this takes a moment.
          </Text>
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard>
      <Text style={styles.gateTitle}>{mode === 'create' ? 'Set up your vault' : 'Unlock vault'}</Text>
      <Text style={styles.gateBody}>
        {mode === 'create'
          ? 'Your finances are encrypted on this device with a passphrase. There is no recovery if you forget it.'
          : 'Enter your passphrase to decrypt your finances.'}
      </Text>

      <TextField
        label="Passphrase"
        placeholder="At least 8 characters"
        value={passphrase}
        onChangeText={setPassphrase}
        secureTextEntry
        autoCapitalize="none"
      />
      {mode === 'create' ? (
        <>
          <TextField
            label="Confirm passphrase"
            placeholder="Re-enter passphrase"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
          />
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Default Currency</Text>
            <InlinePickerField
              placeholder="Select currency"
              valueLabel={currencyLabel}
              onPress={() => setCurrencyPickerOpen(true)}
            />
          </View>
        </>
      ) : null}

      {error ? <Text style={styles.gateError}>{error}</Text> : null}

      <View style={styles.modalFooterEnd}>
        <ActionButton
          label={busy ? 'Working…' : mode === 'create' ? 'Create Vault' : 'Unlock'}
          icon={mode === 'create' ? 'lock-closed' : 'lock-open'}
          onPress={submit}
          disabled={busy || passphrase.length < 8}
        />
      </View>

      <OptionPickerSheet
        visible={currencyPickerOpen}
        title="Default Currency"
        options={currencyOptions}
        selectedValue={currency}
        searchable
        searchPlaceholder="Search currency…"
        onSelect={setCurrency}
        onClose={() => setCurrencyPickerOpen(false)}
      />
    </SectionCard>
  );
}

function TransactionModal({ visible, initial, accounts, categories, onClose, onSave, onDelete }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { alert } = useDialog();
  const [form, setForm] = useState(null);
  const [picker, setPicker] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    setForm(initial);
    setPicker('');
  }, [visible, initial]);

  if (!form) return null;

  const isTransfer = form.type === 'transfer';
  const accountOptions = accounts.filter((a) => !a.archived).map((a) => ({ value: a.id, label: a.name, color: a.color }));
  const categoryOptions = categories.filter((c) => !c.archived && c.type === form.type).map((c) => ({ value: c.id, label: c.name, color: c.color }));
  const toAccountOptions = accountOptions.filter((a) => a.value !== form.accountId);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const labelFor = (options, value) => options.find((o) => o.value === value)?.label || '';

  const handleSave = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { alert({ message: 'Enter a valid amount.' }); return; }
    if (!form.accountId) { alert({ message: 'Select an account.' }); return; }
    if (isTransfer) {
      if (!form.toAccountId) { alert({ message: 'Select a destination account.' }); return; }
      if (form.toAccountId === form.accountId) { alert({ message: 'Choose two different accounts.' }); return; }
    } else if (!form.categoryId) {
      alert({ message: 'Select a category.' }); return;
    }
    onSave({
      ...form,
      amount,
      categoryId: isTransfer ? '' : form.categoryId,
      toAccountId: isTransfer ? form.toAccountId : '',
      date: getYYYYMMDD(new Date(form.date)),
    });
  };

  return (
    <ModalSheet
      visible={visible}
      title={form.editing ? 'Edit Transaction' : 'New Transaction'}
      onClose={onClose}
      headerActions={form.editing && onDelete ? (
        <Pressable hitSlop={10} onPress={() => onDelete(form)}>
          <Trash2 color={theme.colors.danger} size={16} strokeWidth={1.7} />
        </Pressable>
      ) : null}
      footer={(
        <View style={styles.modalFooterEnd}>
          <ActionButton label="Save" icon="checkmark" onPress={handleSave} />
        </View>
      )}
    >
      <Segmented options={TRANSACTION_TYPE_TABS} value={form.type} onChange={(value) => update('type', value)} />
      <TextField
        label="Amount"
        placeholder="0.00"
        value={String(form.amount ?? '')}
        onChangeText={(value) => update('amount', value.replace(/[^0-9.]/g, ''))}
        keyboardType="decimal-pad"
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>{isTransfer ? 'From Account' : 'Account'}</Text>
        <InlinePickerField placeholder="Select account" valueLabel={labelFor(accountOptions, form.accountId)} onPress={() => setPicker('account')} />
      </View>

      {isTransfer ? (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>To Account</Text>
          <InlinePickerField placeholder="Select account" valueLabel={labelFor(accountOptions, form.toAccountId)} onPress={() => setPicker('toAccount')} />
        </View>
      ) : (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Category</Text>
          <InlinePickerField placeholder="Select category" valueLabel={labelFor(categoryOptions, form.categoryId)} onPress={() => setPicker('category')} />
        </View>
      )}

      <DateTimeField label="Date" mode="date" value={form.date} onChange={(value) => update('date', value)} placeholder="Select date" />
      <TextField label="Note" placeholder="Optional" value={form.note} onChangeText={(value) => update('note', value)} multiline />

      <OptionPickerSheet
        visible={picker === 'account'}
        title="Account"
        options={accountOptions}
        selectedValue={form.accountId}
        onSelect={(value) => update('accountId', value)}
        onClose={() => setPicker('')}
      />
      <OptionPickerSheet
        visible={picker === 'toAccount'}
        title="To Account"
        options={toAccountOptions}
        selectedValue={form.toAccountId}
        onSelect={(value) => update('toAccountId', value)}
        onClose={() => setPicker('')}
      />
      <OptionPickerSheet
        visible={picker === 'category'}
        title="Category"
        options={categoryOptions}
        selectedValue={form.categoryId}
        onSelect={(value) => update('categoryId', value)}
        onClose={() => setPicker('')}
      />
    </ModalSheet>
  );
}

export default function FinanceScreen() {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const vault = useVaultContext();
  const addToast = useToast();
  const { confirm } = useDialog();
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [txModal, setTxModal] = useState(null);
  const [manager, setManager] = useState('');
  const [accountDraft, setAccountDraft] = useState({ name: '', type: 'cash', openingBalance: '', color: COLOR_PRESETS[0] });
  const [accountTypePicker, setAccountTypePicker] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState({ name: '', type: 'expense', color: COLOR_PRESETS[3] });
  const [budgetDraft, setBudgetDraft] = useState({ categoryId: '', amount: '' });
  const [budgetCatPicker, setBudgetCatPicker] = useState(false);
  const [currencyPicker, setCurrencyPicker] = useState(false);

  const status = vault?.status;
  const data = vault?.data;
  const actions = vault?.actions;

  const currency = data?.settings?.defaultCurrency || DEFAULT_CURRENCY;
  const hideBalances = Boolean(data?.settings?.hideBalances);
  const transactions = useMemo(() => data?.transactions || [], [data]);
  const accounts = useMemo(() => data?.accounts || [], [data]);
  const categories = useMemo(() => data?.categories || [], [data]);
  const budgets = useMemo(() => data?.budgets || [], [data]);

  const range = useMemo(() => monthRange(monthDate), [monthDate]);
  const monthTx = useMemo(
    () => transactions.filter((tx) => dateInRange(tx.date, range.start, range.end)),
    [transactions, range]
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    monthTx.forEach((tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === 'income') income += amount;
      else if (tx.type === 'expense') expense += amount;
    });
    return { income, expense, net: income - expense };
  }, [monthTx]);

  const totalBalance = useMemo(
    () => accounts.filter((a) => !a.archived).reduce((sum, a) => sum + accountBalance(a, transactions), 0),
    [accounts, transactions]
  );

  const spendingByCategory = useMemo(() => {
    const map = new Map();
    monthTx.filter((tx) => tx.type === 'expense').forEach((tx) => {
      map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + (Number(tx.amount) || 0));
    });
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({ category: categories.find((c) => c.id === categoryId), amount }))
      .filter((row) => row.category)
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx, categories]);

  const groupedTx = useMemo(() => {
    const sorted = [...monthTx].sort((a, b) => (
      a.date === b.date ? (b.createdAt || '').localeCompare(a.createdAt || '') : b.date.localeCompare(a.date)
    ));
    const groups = [];
    sorted.forEach((tx) => {
      const last = groups[groups.length - 1];
      if (last && last.date === tx.date) last.items.push(tx);
      else groups.push({ date: tx.date, items: [tx] });
    });
    return groups;
  }, [monthTx]);

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const persist = useCallback(async (updater) => {
    try {
      await actions.updateData(updater);
    } catch (error) {
      console.error('Vault save failed', error);
      addToast(error?.message || 'Failed to save.', 'error');
    }
  }, [actions, addToast]);

  const money = useCallback(
    (amount, opts) => formatMoney(amount, currency, { hidden: hideBalances, ...opts }),
    [currency, hideBalances]
  );

  const openNewTransaction = useCallback(() => {
    const firstAccount = accounts.find((a) => !a.archived);
    setTxModal({
      editing: false,
      id: generateId(),
      type: 'expense',
      amount: '',
      accountId: firstAccount?.id || '',
      toAccountId: '',
      categoryId: '',
      date: new Date().toISOString(),
      paymentMethod: 'cash',
      note: '',
      tags: [],
      createdAt: new Date().toISOString(),
    });
  }, [accounts]);

  const openEditTransaction = useCallback((tx) => {
    setTxModal({ ...tx, editing: true, amount: String(tx.amount ?? ''), date: `${tx.date}T00:00:00` });
  }, []);

  const handleSaveTransaction = useCallback((tx) => {
    const { editing, ...rest } = tx;
    persist((vaultData) => {
      const list = vaultData.transactions || [];
      const next = editing
        ? list.map((item) => (item.id === rest.id ? { ...item, ...rest } : item))
        : [{ ...rest }, ...list];
      return { ...vaultData, transactions: next };
    });
    setTxModal(null);
  }, [persist]);

  const handleDeleteTransaction = useCallback(async (tx) => {
    const ok = await confirm({
      title: 'Delete transaction?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    persist((vaultData) => ({
      ...vaultData,
      transactions: (vaultData.transactions || []).filter((item) => item.id !== tx.id),
    }));
    setTxModal(null);
  }, [confirm, persist]);

  if (!vault || status === 'initializing') {
    return <LoadingScreen message="Opening vault…" />;
  }

  if (status === 'empty') {
    return (
      <ScreenShell title="Finance" showPageHeader={false}>
        <GateForm mode="create" error={vault.error} onSubmit={actions.createVault} />
      </ScreenShell>
    );
  }

  if (status === 'locked' || status === 'unlocking') {
    return (
      <ScreenShell title="Finance" showPageHeader={false}>
        <GateForm mode="unlock" error={vault.error} onSubmit={({ passphrase }) => actions.unlock(passphrase)} />
      </ScreenShell>
    );
  }

  if (status === 'error') {
    return (
      <ScreenShell title="Finance" showPageHeader={false}>
        <SectionCard><Text style={styles.gateError}>{vault.error || 'Vault error.'}</Text></SectionCard>
      </ScreenShell>
    );
  }

  return (
    <>
      <ScreenShell
        title="Finance"
        showPageHeader={false}
        stickyHeader={(
          <View style={styles.headerRow}>
            <View style={styles.monthNav}>
              <Pressable hitSlop={8} onPress={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                <Text style={styles.monthArrow}>‹</Text>
              </Pressable>
              <Text style={styles.monthLabel}>{formatMonthLabel(monthDate)}</Text>
              <Pressable hitSlop={8} onPress={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                <Text style={styles.monthArrow}>›</Text>
              </Pressable>
            </View>
            <View style={styles.headerActions}>
              <Pressable hitSlop={8} onPress={() => persist((v) => ({ ...v, settings: { ...v.settings, hideBalances: !hideBalances } }))}>
                {hideBalances
                  ? <EyeOff color={theme.colors.tertiary} size={18} strokeWidth={1.7} />
                  : <Eye color={theme.colors.tertiary} size={18} strokeWidth={1.7} />}
              </Pressable>
              <Pressable hitSlop={8} onPress={() => setManager('settings')}>
                <Settings2 color={theme.colors.tertiary} size={18} strokeWidth={1.7} />
              </Pressable>
            </View>
          </View>
        )}
      >
        <SectionCard>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceValue}>{money(totalBalance)}</Text>
          <View style={styles.flowRow}>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel}>Income</Text>
              <Text style={[styles.flowValue, { color: theme.colors.success }]}>{money(totals.income)}</Text>
            </View>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel}>Expense</Text>
              <Text style={[styles.flowValue, { color: theme.colors.danger }]}>{money(totals.expense)}</Text>
            </View>
            <View style={styles.flowItem}>
              <Text style={styles.flowLabel}>Net</Text>
              <Text style={[styles.flowValue, { color: totals.net >= 0 ? theme.colors.success : theme.colors.danger }]}>
                {money(totals.net, { signed: true })}
              </Text>
            </View>
          </View>
        </SectionCard>

        <View style={styles.quickActions}>
          <ActionButton label="Add" icon="add" onPress={openNewTransaction} />
          <ActionButton label="Accounts" variant="ghost" compact onPress={() => setManager('accounts')} />
          <ActionButton label="Categories" variant="ghost" compact onPress={() => setManager('categories')} />
          <ActionButton label="Budgets" variant="ghost" compact onPress={() => setManager('budgets')} />
        </View>

        <Text style={styles.cardHeading}>Transactions</Text>
        {groupedTx.length === 0 ? (
          <SectionCard><Text style={styles.mutedText}>No transactions this month.</Text></SectionCard>
        ) : (
          groupedTx.map((group) => (
            <View key={group.date} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{formatDayLabel(group.date)}</Text>
              {group.items.map((tx) => {
                const category = categoryById.get(tx.categoryId);
                const account = accountById.get(tx.accountId);
                const isTransfer = tx.type === 'transfer';
                const toAccount = isTransfer ? accountById.get(tx.toAccountId) : null;
                const amountColor = isTransfer
                  ? theme.colors.secondary
                  : tx.type === 'income' ? theme.colors.success : theme.colors.danger;
                const sign = isTransfer ? '' : tx.type === 'income' ? '+' : '−';
                return (
                  <Pressable key={tx.id} style={styles.txRow} onPress={() => openEditTransaction(tx)}>
                    <View style={[styles.dot, { backgroundColor: isTransfer ? theme.colors.info : (category?.color || theme.colors.muted) }]} />
                    <View style={styles.txMain}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {isTransfer ? `${account?.name || '?'} → ${toAccount?.name || '?'}` : (category?.name || 'Uncategorized')}
                      </Text>
                      <Text style={styles.txSub} numberOfLines={1}>
                        {[account?.name, tx.note].filter(Boolean).join(' · ') || account?.name || ''}
                      </Text>
                    </View>
                    <Text style={[styles.txAmount, { color: amountColor }]}>
                      {sign}{money(tx.amount).replace(/^[+−-]/, '')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScreenShell>

      <TransactionModal
        visible={Boolean(txModal)}
        initial={txModal}
        accounts={accounts}
        categories={categories}
        onClose={() => setTxModal(null)}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
      />

      <ModalSheet
        visible={manager === 'accounts'}
        title="Accounts"
        onClose={() => setManager('')}
        footer={(
          <View style={styles.modalFooterEnd}>
            <ActionButton
              label="Add Account"
              icon="add"
              disabled={!accountDraft.name.trim()}
              onPress={() => {
                persist((v) => ({
                  ...v,
                  accounts: [...(v.accounts || []), {
                    id: generateId(),
                    name: accountDraft.name.trim(),
                    type: accountDraft.type,
                    currency,
                    openingBalance: Number(accountDraft.openingBalance) || 0,
                    color: accountDraft.color,
                    archived: false,
                    note: '',
                    createdAt: new Date().toISOString(),
                  }],
                }));
                setAccountDraft({ name: '', type: 'cash', openingBalance: '', color: COLOR_PRESETS[0] });
              }}
            />
          </View>
        )}
        stickyContent={(
          <>
            <TextField label="New Account" placeholder="Account name" value={accountDraft.name} onChangeText={(v) => setAccountDraft((d) => ({ ...d, name: v }))} />
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Type</Text>
              <InlinePickerField placeholder="Account type" valueLabel={ACCOUNT_TYPES.find((t) => t.value === accountDraft.type)?.label || ''} onPress={() => setAccountTypePicker(true)} />
            </View>
            <TextField label="Opening Balance" placeholder="0.00" keyboardType="decimal-pad" value={accountDraft.openingBalance} onChangeText={(v) => setAccountDraft((d) => ({ ...d, openingBalance: v.replace(/[^0-9.-]/g, '') }))} />
            <ColorField label="Color" value={accountDraft.color} onChange={(v) => setAccountDraft((d) => ({ ...d, color: v }))} presetColors={COLOR_PRESETS} />
          </>
        )}
      >
        {accounts.filter((a) => !a.archived).map((account) => (
          <View key={account.id} style={styles.manageRow}>
            <View style={[styles.dot, { backgroundColor: account.color }]} />
            <View style={styles.manageMain}>
              <Text style={styles.manageName}>{account.name}</Text>
              <Text style={styles.manageSub}>{money(accountBalance(account, transactions))}</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={async () => {
                const ok = await confirm({
                  title: 'Archive account?',
                  message: `"${account.name}" will be hidden.`,
                  confirmLabel: 'Archive',
                  destructive: true,
                });
                if (!ok) return;
                persist((v) => ({ ...v, accounts: v.accounts.map((a) => (a.id === account.id ? { ...a, archived: true } : a)) }));
              }}
            >
              <Trash2 color={theme.colors.danger} size={15} strokeWidth={1.6} />
            </Pressable>
          </View>
        ))}
        <OptionPickerSheet
          visible={accountTypePicker}
          title="Account Type"
          options={ACCOUNT_TYPES}
          selectedValue={accountDraft.type}
          onSelect={(v) => setAccountDraft((d) => ({ ...d, type: v }))}
          onClose={() => setAccountTypePicker(false)}
        />
      </ModalSheet>

      <ModalSheet
        visible={manager === 'categories'}
        title="Categories"
        onClose={() => setManager('')}
        footer={(
          <View style={styles.modalFooterEnd}>
            <ActionButton
              label="Add Category"
              icon="add"
              disabled={!categoryDraft.name.trim()}
              onPress={() => {
                persist((v) => ({
                  ...v,
                  categories: [...(v.categories || []), {
                    id: generateId(),
                    name: categoryDraft.name.trim(),
                    type: categoryDraft.type,
                    color: categoryDraft.color,
                    archived: false,
                    createdAt: new Date().toISOString(),
                  }],
                }));
                setCategoryDraft({ name: '', type: 'expense', color: COLOR_PRESETS[3] });
              }}
            />
          </View>
        )}
        stickyContent={(
          <>
            <Segmented options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} value={categoryDraft.type} onChange={(v) => setCategoryDraft((d) => ({ ...d, type: v }))} />
            <TextField label="New Category" placeholder="Category name" value={categoryDraft.name} onChangeText={(v) => setCategoryDraft((d) => ({ ...d, name: v }))} />
            <ColorField label="Color" value={categoryDraft.color} onChange={(v) => setCategoryDraft((d) => ({ ...d, color: v }))} presetColors={COLOR_PRESETS} />
          </>
        )}
      >
        {categories.filter((c) => !c.archived).map((category) => (
          <View key={category.id} style={styles.manageRow}>
            <View style={[styles.dot, { backgroundColor: category.color }]} />
            <View style={styles.manageMain}>
              <Text style={styles.manageName}>{category.name}</Text>
              <Text style={styles.manageSub}>{category.type}</Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => persist((v) => ({ ...v, categories: v.categories.map((c) => (c.id === category.id ? { ...c, archived: true } : c)) }))}
            >
              <Trash2 color={theme.colors.danger} size={15} strokeWidth={1.6} />
            </Pressable>
          </View>
        ))}
      </ModalSheet>

      <ModalSheet
        visible={manager === 'budgets'}
        title="Budgets"
        onClose={() => setManager('')}
        footer={(
          <View style={styles.modalFooterEnd}>
            <ActionButton
              label="Add Budget"
              icon="add"
              disabled={!budgetDraft.categoryId || !budgetDraft.amount}
              onPress={() => {
                persist((v) => ({
                  ...v,
                  budgets: [...(v.budgets || []), {
                    id: generateId(),
                    categoryId: budgetDraft.categoryId,
                    amount: Number(budgetDraft.amount) || 0,
                    period: 'month',
                  }],
                }));
                setBudgetDraft({ categoryId: '', amount: '' });
              }}
            />
          </View>
        )}
        stickyContent={(
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              <InlinePickerField placeholder="Select category" valueLabel={categoryById.get(budgetDraft.categoryId)?.name || ''} onPress={() => setBudgetCatPicker(true)} />
            </View>
            <TextField label="Monthly Limit" placeholder="0.00" keyboardType="decimal-pad" value={budgetDraft.amount} onChangeText={(v) => setBudgetDraft((d) => ({ ...d, amount: v.replace(/[^0-9.]/g, '') }))} />
          </>
        )}
      >
        {budgets.map((budget) => {
          const category = categoryById.get(budget.categoryId);
          const spent = spendingByCategory.find((r) => r.category?.id === budget.categoryId)?.amount || 0;
          const pct = budget.amount > 0 ? Math.min(Math.round((spent / budget.amount) * 100), 999) : 0;
          return (
            <View key={budget.id} style={styles.manageRow}>
              <View style={[styles.dot, { backgroundColor: category?.color || theme.colors.muted }]} />
              <View style={styles.manageMain}>
                <Text style={styles.manageName}>{category?.name || 'Category'}</Text>
                <Text style={[styles.manageSub, { color: pct > 100 ? theme.colors.danger : theme.colors.tertiary }]}>
                  {money(spent)} / {money(budget.amount)} · {pct}%
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={() => persist((v) => ({ ...v, budgets: v.budgets.filter((b) => b.id !== budget.id) }))}>
                <Trash2 color={theme.colors.danger} size={15} strokeWidth={1.6} />
              </Pressable>
            </View>
          );
        })}
        <OptionPickerSheet
          visible={budgetCatPicker}
          title="Category"
          options={categories.filter((c) => !c.archived && c.type === 'expense').map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          selectedValue={budgetDraft.categoryId}
          onSelect={(v) => setBudgetDraft((d) => ({ ...d, categoryId: v }))}
          onClose={() => setBudgetCatPicker(false)}
        />
      </ModalSheet>

      <ModalSheet visible={manager === 'settings'} title="Finance Settings" onClose={() => setManager('')}>
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Default Currency</Text>
          <InlinePickerField placeholder="Currency" valueLabel={getCurrencyMeta(currency).label} onPress={() => setCurrencyPicker(true)} />
        </View>
        <Pressable style={styles.settingsRow} onPress={() => persist((v) => ({ ...v, settings: { ...v.settings, hideBalances: !hideBalances } }))}>
          <Text style={styles.settingsLabel}>Hide balances</Text>
          <Text style={styles.settingsValue}>{hideBalances ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.settingsRow} onPress={() => { setManager(''); actions.lock(); }}>
          <View style={styles.settingsIconLabel}>
            <Lock color={theme.colors.secondary} size={15} strokeWidth={1.7} />
            <Text style={styles.settingsLabel}>Lock vault now</Text>
          </View>
        </Pressable>
        <Pressable
          style={styles.settingsRow}
          onPress={async () => {
            const ok = await confirm({
              title: 'Delete vault?',
              message: 'This permanently erases all finance data on this device. There is no recovery.',
              confirmLabel: 'Delete',
              destructive: true,
            });
            if (!ok) return;
            setManager('');
            actions.destroyVault();
          }}
        >
          <View style={styles.settingsIconLabel}>
            <Trash2 color={theme.colors.danger} size={15} strokeWidth={1.7} />
            <Text style={[styles.settingsLabel, { color: theme.colors.danger }]}>Delete vault</Text>
          </View>
        </Pressable>
        <OptionPickerSheet
          visible={currencyPicker}
          title="Default Currency"
          options={CURRENCY_OPTIONS.map((item) => ({ value: item.code, label: `${item.code} — ${item.label}` }))}
          selectedValue={currency}
          searchable
          searchPlaceholder="Search currency…"
          onSelect={(value) => persist((v) => ({ ...v, settings: { ...v.settings, defaultCurrency: value } }))}
          onClose={() => setCurrencyPicker(false)}
        />
      </ModalSheet>
    </>
  );
}

const makeStyles = (theme) => StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  monthArrow: { color: theme.colors.secondary, fontSize: 24, lineHeight: 26 },
  monthLabel: { color: theme.colors.text, fontSize: 13, fontWeight: '500', letterSpacing: 1, textTransform: 'uppercase', minWidth: 130, textAlign: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  balanceLabel: { color: theme.colors.tertiary, fontSize: 10, fontWeight: '500', letterSpacing: 1.4, textTransform: 'uppercase' },
  balanceValue: { color: theme.colors.text, fontSize: 30, fontWeight: '600', letterSpacing: 0.5, marginTop: 4 },
  flowRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  flowItem: { flex: 1, gap: 3 },
  flowLabel: { color: theme.colors.muted, fontSize: 9, fontWeight: '500', letterSpacing: 1, textTransform: 'uppercase' },
  flowValue: { fontSize: 14, fontWeight: '500' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cardHeading: { color: theme.colors.secondary, fontSize: 11, fontWeight: '500', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dayGroup: { gap: 4 },
  dayLabel: { color: theme.colors.tertiary, fontSize: 10, fontWeight: '500', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 6 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.borderDim },
  txMain: { flex: 1, gap: 2 },
  txTitle: { color: theme.colors.text, fontSize: 14, letterSpacing: 0.2 },
  txSub: { color: theme.colors.muted, fontSize: 11 },
  txAmount: { fontSize: 14, fontWeight: '600' },
  mutedText: { color: theme.colors.tertiary, fontSize: 12 },
  gateTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  gateBody: { color: theme.colors.tertiary, fontSize: 12, lineHeight: 18, marginBottom: 8 },
  gateError: { color: theme.colors.danger, fontSize: 12 },
  gateLoading: { alignItems: 'center', justifyContent: 'center', paddingVertical: 28, gap: 12 },
  gateLoadingTitle: { color: theme.colors.text, fontSize: 13, fontWeight: '500', letterSpacing: 1.4, textTransform: 'uppercase' },
  gateLoadingHint: { color: theme.colors.tertiary, fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 260 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: theme.colors.tertiary, fontSize: 10, fontWeight: '500', letterSpacing: 1.4, textTransform: 'uppercase' },
  modalFooterEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  segmented: { flexDirection: 'row', borderWidth: 1, borderColor: theme.colors.borderDim },
  segmentedTab: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  segmentedTabActive: { backgroundColor: theme.colors.surfaceSoft },
  segmentedLabel: { color: theme.colors.tertiary, fontSize: 11, fontWeight: '500', letterSpacing: 1, textTransform: 'uppercase' },
  segmentedLabelActive: { color: theme.colors.text },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  manageMain: { flex: 1, gap: 2 },
  manageName: { color: theme.colors.text, fontSize: 14 },
  manageSub: { color: theme.colors.tertiary, fontSize: 11 },
  divider: { height: 1, backgroundColor: theme.colors.borderDim, marginVertical: 8 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.borderDim },
  settingsIconLabel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsLabel: { color: theme.colors.text, fontSize: 14 },
  settingsValue: { color: theme.colors.tertiary, fontSize: 13 },
});
