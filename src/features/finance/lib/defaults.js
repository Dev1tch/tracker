'use client';

export const SCHEMA_VERSION = 1;

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_OPTIONS = [
  { code: 'AED', symbol: 'AED', label: 'United Arab Emirates Dirham' },
  { code: 'AFN', symbol: '؋', label: 'Afghan Afghani' },
  { code: 'ALL', symbol: 'ALL', label: 'Albanian Lek' },
  { code: 'AMD', symbol: '֏', label: 'Armenian Dram' },
  { code: 'ANG', symbol: 'ANG', label: 'Netherlands Antillean Guilder' },
  { code: 'AOA', symbol: 'Kz', label: 'Angolan Kwanza' },
  { code: 'ARS', symbol: '$', label: 'Argentine Peso' },
  { code: 'AUD', symbol: '$', label: 'Australian Dollar' },
  { code: 'AWG', symbol: 'AWG', label: 'Aruban Florin' },
  { code: 'AZN', symbol: '₼', label: 'Azerbaijani Manat' },
  { code: 'BAM', symbol: 'KM', label: 'Bosnia-Herzegovina Convertible Mark' },
  { code: 'BBD', symbol: '$', label: 'Barbadian Dollar' },
  { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka' },
  { code: 'BGN', symbol: 'BGN', label: 'Bulgarian Lev' },
  { code: 'BHD', symbol: 'BHD', label: 'Bahraini Dinar' },
  { code: 'BIF', symbol: 'BIF', label: 'Burundian Franc' },
  { code: 'BMD', symbol: '$', label: 'Bermudan Dollar' },
  { code: 'BND', symbol: '$', label: 'Brunei Dollar' },
  { code: 'BOB', symbol: 'Bs', label: 'Bolivian Boliviano' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'BSD', symbol: '$', label: 'Bahamian Dollar' },
  { code: 'BTN', symbol: 'BTN', label: 'Bhutanese Ngultrum' },
  { code: 'BWP', symbol: 'P', label: 'Botswanan Pula' },
  { code: 'BYN', symbol: 'BYN', label: 'Belarusian Ruble' },
  { code: 'BZD', symbol: '$', label: 'Belize Dollar' },
  { code: 'CAD', symbol: '$', label: 'Canadian Dollar' },
  { code: 'CDF', symbol: 'CDF', label: 'Congolese Franc' },
  { code: 'CHF', symbol: 'CHF', label: 'Swiss Franc' },
  { code: 'CLP', symbol: '$', label: 'Chilean Peso' },
  { code: 'CNY', symbol: '¥', label: 'Chinese Yuan' },
  { code: 'COP', symbol: '$', label: 'Colombian Peso' },
  { code: 'CRC', symbol: '₡', label: 'Costa Rican Colón' },
  { code: 'CUC', symbol: '$', label: 'Cuban Convertible Peso' },
  { code: 'CUP', symbol: '$', label: 'Cuban Peso' },
  { code: 'CVE', symbol: 'CVE', label: 'Cape Verdean Escudo' },
  { code: 'CZK', symbol: 'Kč', label: 'Czech Koruna' },
  { code: 'DJF', symbol: 'DJF', label: 'Djiboutian Franc' },
  { code: 'DKK', symbol: 'kr', label: 'Danish Krone' },
  { code: 'DOP', symbol: '$', label: 'Dominican Peso' },
  { code: 'DZD', symbol: 'DZD', label: 'Algerian Dinar' },
  { code: 'EGP', symbol: 'E£', label: 'Egyptian Pound' },
  { code: 'ERN', symbol: 'ERN', label: 'Eritrean Nakfa' },
  { code: 'ETB', symbol: 'ETB', label: 'Ethiopian Birr' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'FJD', symbol: '$', label: 'Fijian Dollar' },
  { code: 'FKP', symbol: '£', label: 'Falkland Islands Pound' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'GEL', symbol: '₾', label: 'Georgian Lari' },
  { code: 'GHS', symbol: 'GH₵', label: 'Ghanaian Cedi' },
  { code: 'GIP', symbol: '£', label: 'Gibraltar Pound' },
  { code: 'GMD', symbol: 'GMD', label: 'Gambian Dalasi' },
  { code: 'GNF', symbol: 'FG', label: 'Guinean Franc' },
  { code: 'GTQ', symbol: 'Q', label: 'Guatemalan Quetzal' },
  { code: 'GYD', symbol: '$', label: 'Guyanaese Dollar' },
  { code: 'HKD', symbol: '$', label: 'Hong Kong Dollar' },
  { code: 'HNL', symbol: 'L', label: 'Honduran Lempira' },
  { code: 'HRK', symbol: 'kn', label: 'Croatian Kuna' },
  { code: 'HTG', symbol: 'HTG', label: 'Haitian Gourde' },
  { code: 'HUF', symbol: 'Ft', label: 'Hungarian Forint' },
  { code: 'IDR', symbol: 'Rp', label: 'Indonesian Rupiah' },
  { code: 'ILS', symbol: '₪', label: 'Israeli New Shekel' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'IQD', symbol: 'IQD', label: 'Iraqi Dinar' },
  { code: 'IRR', symbol: 'IRR', label: 'Iranian Rial' },
  { code: 'ISK', symbol: 'kr', label: 'Icelandic Króna' },
  { code: 'JMD', symbol: '$', label: 'Jamaican Dollar' },
  { code: 'JOD', symbol: 'JOD', label: 'Jordanian Dinar' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'KES', symbol: 'KES', label: 'Kenyan Shilling' },
  { code: 'KGS', symbol: '⃀', label: 'Kyrgystani Som' },
  { code: 'KHR', symbol: '៛', label: 'Cambodian Riel' },
  { code: 'KMF', symbol: 'CF', label: 'Comorian Franc' },
  { code: 'KPW', symbol: '₩', label: 'North Korean Won' },
  { code: 'KRW', symbol: '₩', label: 'South Korean Won' },
  { code: 'KWD', symbol: 'KWD', label: 'Kuwaiti Dinar' },
  { code: 'KYD', symbol: '$', label: 'Cayman Islands Dollar' },
  { code: 'KZT', symbol: '₸', label: 'Kazakhstani Tenge' },
  { code: 'LAK', symbol: '₭', label: 'Laotian Kip' },
  { code: 'LBP', symbol: 'L£', label: 'Lebanese Pound' },
  { code: 'LKR', symbol: 'Rs', label: 'Sri Lankan Rupee' },
  { code: 'LRD', symbol: '$', label: 'Liberian Dollar' },
  { code: 'LSL', symbol: 'LSL', label: 'Lesotho Loti' },
  { code: 'LYD', symbol: 'LYD', label: 'Libyan Dinar' },
  { code: 'MAD', symbol: 'MAD', label: 'Moroccan Dirham' },
  { code: 'MDL', symbol: 'MDL', label: 'Moldovan Leu' },
  { code: 'MGA', symbol: 'Ar', label: 'Malagasy Ariary' },
  { code: 'MKD', symbol: 'MKD', label: 'Macedonian Denar' },
  { code: 'MMK', symbol: 'K', label: 'Myanmar Kyat' },
  { code: 'MNT', symbol: '₮', label: 'Mongolian Tugrik' },
  { code: 'MOP', symbol: 'MOP', label: 'Macanese Pataca' },
  { code: 'MRU', symbol: 'MRU', label: 'Mauritanian Ouguiya' },
  { code: 'MUR', symbol: 'Rs', label: 'Mauritian Rupee' },
  { code: 'MVR', symbol: 'MVR', label: 'Maldivian Rufiyaa' },
  { code: 'MWK', symbol: 'MWK', label: 'Malawian Kwacha' },
  { code: 'MXN', symbol: '$', label: 'Mexican Peso' },
  { code: 'MYR', symbol: 'RM', label: 'Malaysian Ringgit' },
  { code: 'MZN', symbol: 'MZN', label: 'Mozambican Metical' },
  { code: 'NAD', symbol: '$', label: 'Namibian Dollar' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  { code: 'NIO', symbol: 'C$', label: 'Nicaraguan Córdoba' },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone' },
  { code: 'NPR', symbol: 'Rs', label: 'Nepalese Rupee' },
  { code: 'NZD', symbol: '$', label: 'New Zealand Dollar' },
  { code: 'OMR', symbol: 'OMR', label: 'Omani Rial' },
  { code: 'PAB', symbol: 'PAB', label: 'Panamanian Balboa' },
  { code: 'PEN', symbol: 'PEN', label: 'Peruvian Sol' },
  { code: 'PGK', symbol: 'PGK', label: 'Papua New Guinean Kina' },
  { code: 'PHP', symbol: '₱', label: 'Philippine Peso' },
  { code: 'PKR', symbol: 'Rs', label: 'Pakistani Rupee' },
  { code: 'PLN', symbol: 'zł', label: 'Polish Zloty' },
  { code: 'PYG', symbol: '₲', label: 'Paraguayan Guarani' },
  { code: 'QAR', symbol: 'QAR', label: 'Qatari Riyal' },
  { code: 'RON', symbol: 'lei', label: 'Romanian Leu' },
  { code: 'RSD', symbol: 'RSD', label: 'Serbian Dinar' },
  { code: 'RUB', symbol: '₽', label: 'Russian Ruble' },
  { code: 'RWF', symbol: 'RF', label: 'Rwandan Franc' },
  { code: 'SAR', symbol: 'SAR', label: 'Saudi Riyal' },
  { code: 'SBD', symbol: '$', label: 'Solomon Islands Dollar' },
  { code: 'SCR', symbol: 'SCR', label: 'Seychellois Rupee' },
  { code: 'SDG', symbol: 'SDG', label: 'Sudanese Pound' },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona' },
  { code: 'SGD', symbol: '$', label: 'Singapore Dollar' },
  { code: 'SHP', symbol: '£', label: 'St. Helena Pound' },
  { code: 'SLE', symbol: 'SLE', label: 'Sierra Leonean Leone' },
  { code: 'SLL', symbol: 'SLL', label: 'Sierra Leonean Leone (1964-2022)' },
  { code: 'SOS', symbol: 'SOS', label: 'Somali Shilling' },
  { code: 'SRD', symbol: '$', label: 'Surinamese Dollar' },
  { code: 'SSP', symbol: '£', label: 'South Sudanese Pound' },
  { code: 'STN', symbol: 'Db', label: 'São Tomé & Príncipe Dobra' },
  { code: 'SVC', symbol: 'SVC', label: 'Salvadoran Colón' },
  { code: 'SYP', symbol: '£', label: 'Syrian Pound' },
  { code: 'SZL', symbol: 'SZL', label: 'Swazi Lilangeni' },
  { code: 'THB', symbol: '฿', label: 'Thai Baht' },
  { code: 'TJS', symbol: 'TJS', label: 'Tajikistani Somoni' },
  { code: 'TMT', symbol: 'TMT', label: 'Turkmenistani Manat' },
  { code: 'TND', symbol: 'TND', label: 'Tunisian Dinar' },
  { code: 'TOP', symbol: 'T$', label: 'Tongan Paʻanga' },
  { code: 'TRY', symbol: '₺', label: 'Turkish Lira' },
  { code: 'TTD', symbol: '$', label: 'Trinidad & Tobago Dollar' },
  { code: 'TWD', symbol: '$', label: 'New Taiwan Dollar' },
  { code: 'TZS', symbol: 'TZS', label: 'Tanzanian Shilling' },
  { code: 'UAH', symbol: '₴', label: 'Ukrainian Hryvnia' },
  { code: 'UGX', symbol: 'UGX', label: 'Ugandan Shilling' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'UYU', symbol: '$', label: 'Uruguayan Peso' },
  { code: 'UZS', symbol: 'UZS', label: 'Uzbekistani Som' },
  { code: 'VES', symbol: 'VES', label: 'Venezuelan Bolívar' },
  { code: 'VND', symbol: '₫', label: 'Vietnamese Dong' },
  { code: 'VUV', symbol: 'VUV', label: 'Vanuatu Vatu' },
  { code: 'WST', symbol: 'WST', label: 'Samoan Tala' },
  { code: 'XAF', symbol: 'FCFA', label: 'Central African CFA Franc' },
  { code: 'XCD', symbol: '$', label: 'East Caribbean Dollar' },
  { code: 'XCG', symbol: 'Cg.', label: 'Caribbean guilder' },
  { code: 'XDR', symbol: 'XDR', label: 'Special Drawing Rights' },
  { code: 'XOF', symbol: 'F CFA', label: 'West African CFA Franc' },
  { code: 'XPF', symbol: 'CFPF', label: 'CFP Franc' },
  { code: 'XSU', symbol: 'XSU', label: 'Sucre' },
  { code: 'YER', symbol: 'YER', label: 'Yemeni Rial' },
  { code: 'ZAR', symbol: 'R', label: 'South African Rand' },
  { code: 'ZMW', symbol: 'ZK', label: 'Zambian Kwacha' },
  { code: 'ZWG', symbol: 'ZWG', label: 'Zimbabwean Gold' },
  { code: 'ZWL', symbol: 'ZWL', label: 'Zimbabwean Dollar (2009-2024)' },
];

export function formatCurrencyOptionLabel(currency, { includeName = true } = {}) {
  const symbol =
    currency.symbol && currency.symbol !== currency.code && currency.symbol !== currency.label
      ? `${currency.symbol}  `
      : '';
  const prefix = `${symbol}${currency.code}`;
  return includeName ? `${prefix} - ${currency.label}` : prefix;
}

export function currencyToSelectOption(currency, options) {
  return {
    value: currency.code,
    label: formatCurrencyOptionLabel(currency, options),
    searchText: `${currency.code} ${currency.label}`,
  };
}

export const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'card', label: 'Credit / Debit card' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'wallet', label: 'Digital wallet' },
  { value: 'other', label: 'Other' },
];

export const TRANSACTION_TYPES = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', color: '#2ecc71' },
  { name: 'Freelance', color: '#27ae60' },
  { name: 'Investments', color: '#16a085' },
  { name: 'Gifts', color: '#3498db' },
  { name: 'Other income', color: '#7f8c8d' },
];

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Groceries', color: '#e67e22' },
  { name: 'Eating out', color: '#d35400' },
  { name: 'Transport', color: '#3498db' },
  { name: 'Housing', color: '#9b59b6' },
  { name: 'Utilities', color: '#1abc9c' },
  { name: 'Entertainment', color: '#e74c3c' },
  { name: 'Health', color: '#c0392b' },
  { name: 'Shopping', color: '#f39c12' },
  { name: 'Education', color: '#2980b9' },
  { name: 'Other expense', color: '#7f8c8d' },
];

export function buildDefaultVault({ currency = DEFAULT_CURRENCY } = {}) {
  const now = new Date().toISOString();
  const cashId = generateId();
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    settings: {
      defaultCurrency: currency,
      autoLockMinutes: 15,
      hideBalances: false,
      lastBackupAt: null,
      lastBackupReminderDismissedAt: null,
    },
    accounts: [
      {
        id: cashId,
        name: 'Cash',
        type: 'cash',
        currency,
        openingBalance: 0,
        color: '#94a3b8',
        archived: false,
        note: '',
        createdAt: now,
      },
    ],
    categories: [
      ...DEFAULT_INCOME_CATEGORIES.map((c) => ({
        id: generateId(),
        name: c.name,
        type: 'income',
        color: c.color,
        archived: false,
        createdAt: now,
      })),
      ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({
        id: generateId(),
        name: c.name,
        type: 'expense',
        color: c.color,
        archived: false,
        createdAt: now,
      })),
    ],
    transactions: [],
    budgets: [],
    goals: [],
  };
}

export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
