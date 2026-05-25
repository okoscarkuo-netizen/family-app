"use client";

import { logout } from "@/app/actions/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  accountCurrencies,
  accountGroupOrder,
  accountOwners,
  accountSideLabel,
  accountTypes,
  getDisplayAccountBalance,
  getAccountGroup,
  isExpenseLiabilityAccount,
  normalizeFinancialAccount,
  normalizeOwner,
  parseAccountKind,
  type FamilyAccount,
} from "@/lib/finance/types";
import { dashboardStateFingerprint, normalizeDashboardState } from "@/lib/dashboard-state";
import { initialAccounts, normalizeAccounts } from "@/lib/accounts";
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Category = {
  name: string;
  amount: number;
  color: string;
  percent: number;
};

type TodoItem = {
  title: string;
  owner: string;
  due: string;
  done: boolean;
};

type BillReminder = {
  name: string;
  amount: number;
  date: string;
  status: string;
};

type MaintenanceItem = {
  name: string;
  detail: string;
  urgency: string;
  completed: boolean;
};

type RecentEntry = {
  item: string;
  amount: number;
  meta: string;
  account?: string;
  accountAmount?: number;
  currency?: string;
  kind?: "expense" | "income" | "transfer" | "balance" | "template";
  occurredAt?: string;
  originalAmount?: number;
};

type AssetTrendPoint = {
  label: string;
  value: number;
  timestamp: number;
  dateLabel: string;
};

type EntryMode = "expense" | "income" | "transfer";

type EntryFormState = {
  mode: EntryMode;
  amount: string;
  currency: string;
  accountId: string;
  category: string;
  owner: string;
  time: string;
  note: string;
};

const entryModes: { id: EntryMode; label: string }[] = [
  { id: "expense", label: "支出" },
  { id: "income", label: "收入" },
  { id: "transfer", label: "轉帳" },
];

const entryModeLabels: Record<EntryMode, string> = {
  expense: "支出",
  income: "收入",
  transfer: "轉帳",
};

const initialCategories: Category[] = [
  { name: "餐飲", amount: 18420, color: "bg-amber-500", percent: 42 },
  { name: "交通", amount: 6320, color: "bg-sky-500", percent: 14 },
  { name: "家庭用品", amount: 9280, color: "bg-teal-500", percent: 21 },
  { name: "育樂", amount: 5120, color: "bg-rose-500", percent: 12 },
  { name: "其他", amount: 4860, color: "bg-lime-500", percent: 11 },
];

const initialTodos: TodoItem[] = [
  { title: "週末採買：洗衣精、米、牛奶", owner: "Oscar", due: "今天", done: false },
  { title: "確認五月信用卡明細", owner: "Oscar", due: "明天", done: false },
  { title: "整理冰箱與下週菜單", owner: "Livia", due: "週日", done: true },
];

const initialBills: BillReminder[] = [
  { name: "房貸", amount: 48200, date: "5/15", status: "待扣款" },
  { name: "中華電信", amount: 1399, date: "5/18", status: "未繳" },
  { name: "電費", amount: 2460, date: "5/22", status: "預估" },
];

const initialMaintenance: MaintenanceItem[] = [
  { name: "汽車保養", detail: "距離下次保養 1,200 km", urgency: "本月", completed: false },
  { name: "冷氣濾網", detail: "主臥、客廳濾網清潔", urgency: "8 天後", completed: false },
  { name: "淨水器濾芯", detail: "已使用 83 天", urgency: "下月", completed: false },
];

const initialEntries: RecentEntry[] = [
  { item: "全聯採買", amount: -1280, meta: "餐飲 · Livia · 今天", account: "共同信用卡", occurredAt: "2026-05-12T12:00" },
  { item: "停車月租", amount: -3200, meta: "交通 · Oscar · 昨天", account: "薪轉戶", occurredAt: "2026-05-11T12:00" },
  { item: "薪資入帳", amount: 86500, meta: "收入 · Oscar · 5/5", account: "薪轉戶", occurredAt: "2026-05-05T12:00" },
  { item: "瓦斯費", amount: -740, meta: "帳單 · Oscar · 5/3", account: "家庭現金", occurredAt: "2026-05-03T12:00" },
];

type DashboardPage = "home" | "ledger" | "accounts" | "reminders";
type PersonalAccountOwner = "Oscar" | "Livia";

const navItems: { label: string; href: string; page: DashboardPage }[] = [
  { label: "首頁", href: "/", page: "home" },
  { label: "流水", href: "/ledger", page: "ledger" },
  { label: "帳戶", href: "/accounts", page: "accounts" },
  { label: "提醒", href: "/reminders", page: "reminders" },
];

const personalAccountTabs: { owner: PersonalAccountOwner; label: string }[] = [
  { owner: "Oscar", label: "Oscar" },
  { owner: "Livia", label: "Livia" },
];

const storageKey = "family-dashboard-state-v1";
const exchangeRates: Record<string, number> = {
  TWD: 1,
  USD: 29.085827,
  JPY: 0.19,
};
const entryCurrencyOptions = ["TWD", "USD"] as const;

type StoredDashboard = {
  accounts: FamilyAccount[];
  categories: Category[];
  todos: TodoItem[];
  bills: BillReminder[];
  maintenance: MaintenanceItem[];
  entries: RecentEntry[];
};

type DashboardCloudState = Pick<StoredDashboard, "categories" | "todos" | "bills" | "maintenance" | "entries">;

type AccountSyncState = "loading" | "synced" | "syncing" | "local" | "error";

type AccountsApiResponse = {
  accounts?: unknown;
  message?: string;
};

type DashboardStateApiResponse = {
  state?: unknown;
  source?: "cloud" | "missing";
  message?: string;
};

function accountsFingerprint(accounts: FamilyAccount[]) {
  return JSON.stringify(
    accounts.map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      owner: account.owner,
      shared: account.shared ?? false,
      kind: account.kind,
      balance: account.balance,
      currency: account.currency,
      hidden: account.hidden ?? false,
    }))
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyValue(value: number, currency = "TWD", options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(currency === "USD" ? "en-US" : "zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 0 : 2,
    ...options,
  }).format(value);
}

function formatTrendPointDate(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function convertAmount(amount: number, fromCurrency = "TWD", toCurrency = "TWD") {
  const fromRate = exchangeRates[fromCurrency] ?? 1;
  const toRate = exchangeRates[toCurrency] ?? 1;

  return (amount * fromRate) / toRate;
}

function normalizeEntryCurrency(value: FormDataEntryValue | string | null | undefined) {
  const currency = String(value || "TWD").toUpperCase();
  return entryCurrencyOptions.includes(currency as (typeof entryCurrencyOptions)[number]) ? currency : "TWD";
}

function defaultEntryCurrency(account: FamilyAccount | undefined) {
  return normalizeEntryCurrency(account?.currency);
}

function formatEntryAmount(entry: RecentEntry) {
  const currency = entry.currency ?? "TWD";
  const originalAmount = entry.originalAmount ?? entry.amount;

  if (currency === "TWD" || entry.originalAmount === undefined) {
    return formatCurrency(entry.amount);
  }

  return `${formatCurrencyValue(originalAmount, currency)} ≒ ${formatCurrency(entry.amount)}`;
}

function formatCompactCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

const assetTrendRanges = [
  { key: "30d", label: "30天", days: 30 },
  { key: "6m", label: "6個月", days: 183 },
  { key: "2y", label: "2年", days: 730 },
  { key: "5y", label: "5年", days: 1825 },
] as const;
type AssetTrendRangeKey = (typeof assetTrendRanges)[number]["key"];

function buildAssetTrendPoints(
  currentAssetTotal: number,
  entries: RecentEntry[],
  rangeDays: number,
): AssetTrendPoint[] {
  const sortedAssetChanges = entries
    .filter(
      (entry) =>
        entry.kind !== "transfer" &&
        entry.kind !== "template" &&
        entry.amount !== 0 &&
        Boolean(entry.occurredAt),
    )
    .sort(
      (a, b) =>
        new Date(a.occurredAt as string).getTime() -
        new Date(b.occurredAt as string).getTime(),
    );

  const nowMs = Date.now();
  const rangeMs = rangeDays * 86_400_000;
  const rangeStartMs = nowMs - rangeMs;

  const entriesInRange = sortedAssetChanges.filter((entry) => {
    const t = new Date(entry.occurredAt as string).getTime();
    return t >= rangeStartMs && t <= nowMs;
  });

  const totalDeltaInRange = entriesInRange.reduce((sum, e) => sum + e.amount, 0);
  const startValue = currentAssetTotal - totalDeltaInRange;

  const bucketCount = 30;
  const bucketSizeMs = rangeMs / bucketCount;

  const points: AssetTrendPoint[] = [];
  let runningValue = startValue;
  let entryIdx = 0;

  for (let i = 0; i <= bucketCount; i++) {
    const bucketEndMs = rangeStartMs + i * bucketSizeMs;
    while (entryIdx < entriesInRange.length) {
      const t = new Date(entriesInRange[entryIdx].occurredAt as string).getTime();
      if (t <= bucketEndMs) {
        runningValue += entriesInRange[entryIdx].amount;
        entryIdx++;
      } else {
        break;
      }
    }
    const label = i === 0 ? "起點" : i === bucketCount ? "現在" : "";
    const timestamp = Math.min(bucketEndMs, nowMs);
    points.push({
      label,
      value: runningValue,
      timestamp,
      dateLabel: formatTrendPointDate(timestamp),
    });
  }
  return points;
}

function formatAccountBalance(account: FamilyAccount) {
  const rate = exchangeRates[account.currency] ?? 1;
  const displayBalance = getDisplayAccountBalance(account);
  const converted = displayBalance * rate;

  if (account.currency === "TWD") {
    return formatCurrency(displayBalance);
  }

  return `${account.currency} ${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(displayBalance)} ≒ ${formatCurrency(converted)}`;
}

function convertedBalance(account: FamilyAccount) {
  return account.balance * (exchangeRates[account.currency] ?? 1);
}

function accountGroupOrderIndex(group: string) {
  const index = accountGroupOrder.indexOf(group as (typeof accountGroupOrder)[number]);
  return index === -1 ? accountGroupOrder.length : index;
}

function accountNetTotal(accounts: FamilyAccount[]) {
  return accounts.reduce(
    (sum, account) => sum + (account.kind === "asset" ? convertedBalance(account) : -convertedBalance(account)),
    0
  );
}

function groupAccountsByType(accounts: FamilyAccount[]) {
  const groupedAccounts = accounts.reduce<Record<string, FamilyAccount[]>>((groups, account) => {
    const group = getAccountGroup(account);
    groups[group] = groups[group] ?? [];
    groups[group].push(account);
    return groups;
  }, {});

  return Object.entries(groupedAccounts).sort(
    ([firstGroup], [secondGroup]) => accountGroupOrderIndex(firstGroup) - accountGroupOrderIndex(secondGroup)
  );
}

function expenseAccountImpactLabelForCurrency(
  account: FamilyAccount | undefined,
  amount: number,
  currency: string
) {
  const formattedAmount = formatCurrencyValue(amount, currency);

  if (!account) return `支出 ${formattedAmount}`;

  const accountAmount = convertAmount(amount, currency, account.currency);
  const formattedAccountAmount = formatCurrencyValue(accountAmount, account.currency);
  const amountLabel =
    account.currency === currency ? formattedAmount : `${formattedAmount} / ${formattedAccountAmount}`;

  return isExpenseLiabilityAccount(account) ? `負債 +${amountLabel}` : `餘額 -${amountLabel}`;
}

function accountImpactLabelForMode(
  mode: EntryMode,
  account: FamilyAccount | undefined,
  amount: number,
  currency: string
) {
  if (mode === "expense") {
    return expenseAccountImpactLabelForCurrency(account, amount, currency);
  }

  if (mode === "income") {
    const formattedAmount = formatCurrencyValue(amount, currency);
    if (!account) return `收入 ${formattedAmount}`;

    const accountAmount = convertAmount(amount, currency, account.currency);
    const formattedAccountAmount = formatCurrencyValue(accountAmount, account.currency);
    const amountLabel =
      account.currency === currency ? formattedAmount : `${formattedAmount} / ${formattedAccountAmount}`;

    return isExpenseLiabilityAccount(account) ? `負債 -${amountLabel}` : `餘額 +${amountLabel}`;
  }

  return `轉帳 ${formatCurrencyValue(amount, currency)}`;
}

function getLocalDatetimeInputValue(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function formatEntryTime(value: string) {
  if (!value) return "剛剛";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function parseEntryTimestamp(entry: RecentEntry, fallbackIndex = 0) {
  const explicitTime = entry.occurredAt ? new Date(entry.occurredAt).getTime() : Number.NaN;
  if (!Number.isNaN(explicitTime)) return explicitTime;

  const timeText = entry.meta.split(" · ").at(-1)?.trim() ?? "";
  const now = new Date();
  const fallbackTime = now.getTime() - fallbackIndex;

  if (timeText.includes("今天") || timeText.includes("剛剛")) return fallbackTime;
  if (timeText.includes("昨天")) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.getTime() - fallbackIndex;
  }

  const monthDay = timeText.match(/^(\d{1,2})\/(\d{1,2})/);
  if (monthDay) {
    const date = new Date(now.getFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2]), 12);
    if (!Number.isNaN(date.getTime())) return date.getTime() - fallbackIndex;
  }

  return fallbackTime;
}

function sortEntriesNewestFirst(entries: RecentEntry[]) {
  return entries
    .map((entry, index) => ({ entry, index, timestamp: parseEntryTimestamp(entry, index) }))
    .sort((first, second) => second.timestamp - first.timestamp || first.index - second.index);
}

function addExpenseToCategories(categories: Category[], categoryName: string, amount: number) {
  const nextCategories = categories.map((item) =>
    item.name === categoryName ? { ...item, amount: item.amount + amount } : item
  );
  const nextTotal = nextCategories.reduce((sum, item) => sum + item.amount, 0);

  if (!nextTotal) return nextCategories;

  return nextCategories.map((item) => ({
    ...item,
    percent: Math.max(1, Math.round((item.amount / nextTotal) * 100)),
  }));
}

function adjustExpenseCategory(categories: Category[], categoryName: string, amountDelta: number) {
  const nextCategories = categories.map((item) =>
    item.name === categoryName ? { ...item, amount: Math.max(0, item.amount + amountDelta) } : item
  );
  const nextTotal = nextCategories.reduce((sum, item) => sum + item.amount, 0);

  if (!nextTotal) return nextCategories.map((item) => ({ ...item, percent: 0 }));

  return nextCategories.map((item) => ({
    ...item,
    percent: Math.max(1, Math.round((item.amount / nextTotal) * 100)),
  }));
}

function getEntryMetaPart(entry: RecentEntry, partIndex: number, fallback: string) {
  return entry.meta.split(" · ")[partIndex]?.trim() || fallback;
}

function getEntryCategory(entry: RecentEntry) {
  return getEntryMetaPart(entry, 1, "其他");
}

function getEntryOwner(entry: RecentEntry) {
  return normalizeOwner(getEntryMetaPart(entry, 2, "Oscar"));
}

function getEntryAccountAmount(entry: RecentEntry) {
  return Math.abs(entry.accountAmount ?? entry.amount);
}

function entryBelongsToAccount(entry: RecentEntry, account: FamilyAccount) {
  if (entry.account === account.name) return true;

  if (entry.kind === "transfer") {
    return entry.meta.includes(account.name);
  }

  return false;
}

const legacyDemoAccountIds = new Set(["cash", "payroll", "wife-bank", "family-card", "mortgage"]);

function isLegacyDemoAccounts(accounts: FamilyAccount[]) {
  return accounts.length > 0 && accounts.every((account) => legacyDemoAccountIds.has(account.id));
}

function accountSyncLabel(state: AccountSyncState) {
  if (state === "synced") return "";
  if (state === "syncing") return "同步中";
  if (state === "error") return "同步錯誤";
  if (state === "local") return "本機保存";
  return "讀取中";
}

function accountSyncBadgeClass(state: AccountSyncState) {
  if (state === "synced") return "bg-emerald-50 text-emerald-800";
  if (state === "syncing") return "bg-sky-50 text-sky-800";
  if (state === "error") return "bg-rose-50 text-rose-800";
  if (state === "local") return "bg-amber-50 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

export function Dashboard({
  activePage = "home",
  userEmail,
  accountId,
}: {
  activePage?: DashboardPage;
  userEmail: string;
  accountId?: string;
}) {
  const [accounts, setAccounts] = useState(() => initialAccounts.map(normalizeFinancialAccount));
  const [categories, setCategories] = useState(initialCategories);
  const [todos, setTodos] = useState(initialTodos);
  const [bills, setBills] = useState(initialBills);
  const [maintenance, setMaintenance] = useState(initialMaintenance);
  const [entries, setEntries] = useState(initialEntries);
  const [modal, setModal] = useState<
    | "account"
    | "account-detail"
    | "account-edit"
    | "account-import"
    | "entry-edit"
    | "transfer"
    | "entry"
    | "todo"
    | "bill"
    | "maintenance"
    | "entries"
    | null
  >(null);
  const [activeAccountOwner, setActiveAccountOwner] = useState<PersonalAccountOwner>("Oscar");
  const [accountQuery, setAccountQuery] = useState("");
  const [hideZeroAccounts, setHideZeroAccounts] = useState(false);
  const [showHiddenAccounts, setShowHiddenAccounts] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FamilyAccount | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<FamilyAccount | null>(null);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);
  const [hasLoadedLocalData, setHasLoadedLocalData] = useState(false);
  const [accountSyncState, setAccountSyncState] = useState<AccountSyncState>("loading");
  const [accountSyncMessage, setAccountSyncMessage] = useState("正在載入帳戶...");
  const [dashboardSyncState, setDashboardSyncState] = useState<AccountSyncState>("loading");
  const [dashboardSyncMessage, setDashboardSyncMessage] = useState("正在載入提醒與流水...");
  const [assetTrendRange, setAssetTrendRange] = useState<AssetTrendRangeKey>("5y");
  const [accountCloudReady, setAccountCloudReady] = useState(false);
  const [dashboardCloudReady, setDashboardCloudReady] = useState(false);
  const accountCloudReadyRef = useRef(false);
  const lastSyncedAccountsRef = useRef("");
  const dashboardCloudReadyRef = useRef(false);
  const lastSyncedDashboardRef = useRef("");
  const accountSwitcherSentinelRef = useRef<HTMLDivElement | null>(null);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  const saveAccountsToCloud = useCallback(async (nextAccounts: FamilyAccount[], options?: { silent?: boolean }) => {
    if (!accountCloudReadyRef.current) return false;

    const normalizedAccounts = normalizeAccounts(nextAccounts).map(normalizeFinancialAccount);

    if (!options?.silent) {
      setAccountSyncState("syncing");
      setAccountSyncMessage("正在同步帳戶...");
    }

    try {
      const response = await fetch("/api/accounts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts: normalizedAccounts }),
      });
      const payload = (await response.json().catch(() => ({}))) as AccountsApiResponse;

      if (!response.ok) {
        throw new Error(payload.message || "帳戶雲端同步失敗");
      }

      const savedAccounts = normalizeAccounts(payload.accounts ?? normalizedAccounts).map(normalizeFinancialAccount);
      const fingerprint = accountsFingerprint(savedAccounts.length ? savedAccounts : normalizedAccounts);
      lastSyncedAccountsRef.current = fingerprint;
      setAccountSyncState("synced");
      setAccountSyncMessage(`帳戶已同步到雲端 · ${normalizedAccounts.length} 個帳戶`);
      return true;
    } catch (error) {
      setAccountSyncState("local");
      setAccountSyncMessage(error instanceof Error ? `帳戶暫存在本機：${error.message}` : "帳戶暫存在本機");
      return false;
    }
  }, []);

  const saveDashboardStateToCloud = useCallback(async (nextState: DashboardCloudState, options?: { silent?: boolean }) => {
    if (!dashboardCloudReadyRef.current) return false;

    const normalizedState = normalizeDashboardState(nextState);

    if (!options?.silent) {
      setDashboardSyncState("syncing");
      setDashboardSyncMessage("正在同步提醒與流水...");
    }

    try {
      const response = await fetch("/api/dashboard-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: normalizedState }),
      });
      const payload = (await response.json().catch(() => ({}))) as DashboardStateApiResponse;

      if (!response.ok) {
        throw new Error(payload.message || "提醒與流水雲端同步失敗");
      }

      const savedState = normalizeDashboardState(payload.state ?? normalizedState);
      lastSyncedDashboardRef.current = dashboardStateFingerprint(savedState);
      setDashboardSyncState("synced");
      setDashboardSyncMessage(
        `提醒、帳單、保養與流水已同步到雲端 · ${savedState.todos.length + savedState.bills.length + savedState.maintenance.length + savedState.entries.length} 項`
      );
      return true;
    } catch (error) {
      setDashboardSyncState("local");
      setDashboardSyncMessage(error instanceof Error ? `提醒與流水暫存在本機：${error.message}` : "提醒與流水暫存在本機");
      return false;
    }
  }, []);

  const loadCloudAccounts = useCallback(
    async (fallbackAccounts: FamilyAccount[], hasLocalAccounts: boolean) => {
      try {
        const response = await fetch("/api/accounts", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as AccountsApiResponse;

        if (!response.ok) {
          throw new Error(payload.message || "帳戶雲端資料尚未設定");
        }

        const cloudAccounts = normalizeAccounts(payload.accounts).map(normalizeFinancialAccount);
        accountCloudReadyRef.current = true;
        setAccountCloudReady(true);

        if (cloudAccounts.length) {
          lastSyncedAccountsRef.current = accountsFingerprint(cloudAccounts);
          setAccounts(cloudAccounts);
          setAccountSyncState("synced");
          setAccountSyncMessage(`已從雲端載入 ${cloudAccounts.length} 個帳戶`);
          return;
        }

        lastSyncedAccountsRef.current = accountsFingerprint(fallbackAccounts);

        if (hasLocalAccounts || fallbackAccounts.length) {
          await saveAccountsToCloud(fallbackAccounts, { silent: true });
          return;
        }

        setAccountSyncState("synced");
        setAccountSyncMessage("雲端帳戶目前是空的，新修改會自動同步");
      } catch (error) {
        accountCloudReadyRef.current = false;
        setAccountCloudReady(false);
        lastSyncedAccountsRef.current = accountsFingerprint(fallbackAccounts);
        setAccountSyncState("local");
        setAccountSyncMessage(error instanceof Error ? `帳戶暫存在本機：${error.message}` : "帳戶暫存在本機");
      }
    },
    [saveAccountsToCloud]
  );

  const loadCloudDashboardState = useCallback(
    async (fallbackState: DashboardCloudState) => {
      try {
        const response = await fetch("/api/dashboard-state", { cache: "no-store" });
        const payload = (await response.json().catch(() => ({}))) as DashboardStateApiResponse;

        if (!response.ok) {
          throw new Error(payload.message || "提醒與流水雲端資料尚未設定");
        }

        dashboardCloudReadyRef.current = true;
        setDashboardCloudReady(true);

        if (!payload.state || payload.source === "missing") {
          lastSyncedDashboardRef.current = dashboardStateFingerprint(fallbackState);
          setDashboardSyncState("synced");
          setDashboardSyncMessage("雲端提醒與流水目前是空的，新修改會自動同步");
          await saveDashboardStateToCloud(fallbackState, { silent: true });
          return;
        }

        const cloudState = normalizeDashboardState(payload.state);
        lastSyncedDashboardRef.current = dashboardStateFingerprint(cloudState);
        setCategories(cloudState.categories);
        setTodos(cloudState.todos);
        setBills(cloudState.bills);
        setMaintenance(cloudState.maintenance);
        setEntries(cloudState.entries);
        setDashboardSyncState("synced");
        setDashboardSyncMessage(
          `已從雲端載入 ${cloudState.todos.length} 個提醒、${cloudState.bills.length} 筆帳單、${cloudState.maintenance.length} 個保養與 ${cloudState.entries.length} 筆流水`
        );
      } catch (error) {
        dashboardCloudReadyRef.current = false;
        setDashboardCloudReady(false);
        lastSyncedDashboardRef.current = dashboardStateFingerprint(fallbackState);
        setDashboardSyncState("local");
        setDashboardSyncMessage(error instanceof Error ? `提醒與流水暫存在本機：${error.message}` : "提醒與流水暫存在本機");
      }
    },
    [saveDashboardStateToCloud]
  );

  useEffect(() => {
    const loadSavedState = window.setTimeout(() => {
      const saved = window.localStorage.getItem(storageKey);
      let fallbackAccounts = initialAccounts.map(normalizeFinancialAccount);
      let fallbackDashboardState: DashboardCloudState = {
        categories: initialCategories,
        todos: initialTodos,
        bills: initialBills,
        maintenance: initialMaintenance,
        entries: initialEntries,
      };
      let hasLocalAccounts = false;

      if (saved) {
        try {
          const parsed = JSON.parse(saved) as StoredDashboard;
          const savedAccounts = (parsed.accounts ?? initialAccounts).map(normalizeFinancialAccount);
          fallbackAccounts = isLegacyDemoAccounts(savedAccounts)
            ? initialAccounts.map(normalizeFinancialAccount)
            : savedAccounts;
          hasLocalAccounts = Boolean(parsed.accounts?.length) && !isLegacyDemoAccounts(savedAccounts);
          setAccounts(fallbackAccounts);
          setCategories(parsed.categories ?? initialCategories);
          setTodos(parsed.todos ?? initialTodos);
          setBills(parsed.bills ?? initialBills);
          setMaintenance(parsed.maintenance ?? initialMaintenance);
          setEntries(parsed.entries ?? initialEntries);
          fallbackDashboardState = {
            categories: parsed.categories ?? initialCategories,
            todos: parsed.todos ?? initialTodos,
            bills: parsed.bills ?? initialBills,
            maintenance: parsed.maintenance ?? initialMaintenance,
            entries: parsed.entries ?? initialEntries,
          };
        } catch {
          window.localStorage.removeItem(storageKey);
        }
      }

      setHasLoadedLocalData(true);
      void loadCloudAccounts(fallbackAccounts, hasLocalAccounts);
      void loadCloudDashboardState(fallbackDashboardState);
    }, 0);

    return () => window.clearTimeout(loadSavedState);
  }, [loadCloudAccounts, loadCloudDashboardState]);

  useEffect(() => {
    if (!hasLoadedLocalData) return;

    const nextState: StoredDashboard = {
      accounts,
      categories,
      todos,
      bills,
      maintenance,
      entries,
    };

    window.localStorage.setItem(storageKey, JSON.stringify(nextState));
  }, [accounts, bills, categories, entries, hasLoadedLocalData, maintenance, todos]);

  useEffect(() => {
    if (!hasLoadedLocalData || !accountCloudReady) return;

    const nextFingerprint = accountsFingerprint(accounts);
    if (nextFingerprint === lastSyncedAccountsRef.current) return;

    const syncTimer = window.setTimeout(() => {
      void saveAccountsToCloud(accounts);
    }, 700);

    return () => window.clearTimeout(syncTimer);
  }, [accountCloudReady, accounts, hasLoadedLocalData, saveAccountsToCloud]);

  useEffect(() => {
    if (!hasLoadedLocalData || !dashboardCloudReady) return;

    const nextState: DashboardCloudState = {
      categories,
      todos,
      bills,
      maintenance,
      entries,
    };
    const nextFingerprint = dashboardStateFingerprint(nextState);
    if (nextFingerprint === lastSyncedDashboardRef.current) return;

    const syncTimer = window.setTimeout(() => {
      void saveDashboardStateToCloud(nextState);
    }, 700);

    return () => window.clearTimeout(syncTimer);
  }, [bills, categories, dashboardCloudReady, entries, hasLoadedLocalData, maintenance, saveDashboardStateToCloud, todos]);

  const totalSpent = categories.reduce((sum, item) => sum + item.amount, 0);
  const plannedBudget = 58000;
  const remainingBudget = plannedBudget - totalSpent;
  const openTodos = todos.filter((item) => !item.done).length;
  const openBills = bills.filter((item) => item.status !== "已繳").length;
  const openMaintenance = maintenance.filter((item) => !item.completed).length;
  const assetTotal = accounts
    .filter((account) => account.kind === "asset" && !account.hidden)
    .reduce((sum, account) => sum + convertedBalance(account), 0);
  const liabilityTotal = accounts
    .filter((account) => account.kind === "liability" && !account.hidden)
    .reduce((sum, account) => sum + convertedBalance(account), 0);
  const netAssets = assetTotal - liabilityTotal;
  const assetTrendDays = useMemo(
    () => assetTrendRanges.find((r) => r.key === assetTrendRange)?.days ?? 1825,
    [assetTrendRange],
  );
  const assetTrendPoints = useMemo(
    () => buildAssetTrendPoints(assetTotal, entries, assetTrendDays),
    [assetTotal, entries, assetTrendDays],
  );
  const sortedEntries = useMemo(() => sortEntriesNewestFirst(entries), [entries]);
  const hiddenAccountsCount = accounts.filter((account) => account.hidden).length;
  const activeAccounts = accounts.filter((account) => !account.hidden);
  const selectableAccounts = activeAccounts.length ? activeAccounts : accounts;
  const filteredAccounts = accounts.filter((account) => {
    const normalizedQuery = accountQuery.trim().toLowerCase();
    const balanceIsZero = Math.abs(convertedBalance(account)) < 1;
    const searchable = [account.name, account.type, account.owner, account.currency, getAccountGroup(account)]
      .join(" ")
      .toLowerCase();

    if (account.hidden && !showHiddenAccounts) return false;
    if (hideZeroAccounts && balanceIsZero && !account.hidden) return false;
    return !normalizedQuery || searchable.includes(normalizedQuery);
  });
  const personalAccounts = filteredAccounts.filter((account) => normalizeOwner(account.owner) === activeAccountOwner);
  const visibleAccountsCount = personalAccounts.length;
  const activeAccountTab = personalAccountTabs.find((tab) => tab.owner === activeAccountOwner) ?? personalAccountTabs[0];
  const sortedPersonalAccountGroups = groupAccountsByType(personalAccounts);
  const currentSelectedAccount = accountId
    ? accounts.find((account) => account.id === accountId) ?? null
    : selectedAccount
      ? accounts.find((account) => account.id === selectedAccount.id) ?? selectedAccount
      : null;
  const selectedAccountEntries = currentSelectedAccount
    ? sortedEntries.filter(({ entry }) => entryBelongsToAccount(entry, currentSelectedAccount))
    : [];
  const editingEntry = editingEntryIndex === null ? null : entries[editingEntryIndex] ?? null;

  function applyExpenseToAccountBalance(accountId: string, amount: number) {
    setAccounts((current) =>
      current.map((account) => {
        if (account.id !== accountId) return account;

        const nextBalance = isExpenseLiabilityAccount(account)
          ? account.balance + amount
          : account.balance - amount;

        return { ...account, balance: nextBalance };
      })
    );
  }

  function applyIncomeToAccountBalance(accountId: string, amount: number) {
    setAccounts((current) =>
      current.map((account) => {
        if (account.id !== accountId) return account;

        const nextBalance = isExpenseLiabilityAccount(account)
          ? account.balance - amount
          : account.balance + amount;

        return { ...account, balance: nextBalance };
      })
    );
  }

  function adjustExpenseAccountByName(accountName: string | undefined, amount: number, direction: 1 | -1) {
    if (!accountName || amount <= 0) return;

    setAccounts((current) =>
      current.map((account) => {
        if (account.name !== accountName) return account;

        const balanceDelta = isExpenseLiabilityAccount(account) ? amount * direction : -amount * direction;
        return { ...account, balance: account.balance + balanceDelta };
      })
    );
  }

  function reverseEntryAccountImpact(entry: RecentEntry) {
    if (entry.kind !== "expense" || entry.amount >= 0) return;
    adjustExpenseAccountByName(entry.account, getEntryAccountAmount(entry), -1);
    setCategories((current) => adjustExpenseCategory(current, getEntryCategory(entry), -Math.abs(entry.amount)));
  }

  function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const form = new FormData(formElement);
    const rawMode = String(form.get("mode") || "expense");
    const mode: EntryMode = rawMode === "income" ? "income" : "expense";
    const modeLabel = entryModeLabels[mode];
    const fallbackCategory = mode === "income" ? "收入" : "其他";
    const category = String(form.get("category") || fallbackCategory);
    const owner = normalizeOwner(String(form.get("owner") || "Oscar"));
    const occurredAt = String(form.get("time") || getLocalDatetimeInputValue());
    const time = formatEntryTime(occurredAt);
    const title = String(form.get("title") || "").trim();
    const note = String(form.get("note") || "").trim();
    const accountId = String(form.get("accountId") || accounts[0]?.id);
    const amount = Number(form.get("amount") || 0);
    const currency = normalizeEntryCurrency(form.get("currency"));
    const account = accounts.find((item) => item.id === accountId);
    const intent = submitter?.value ?? "save";

    if (!amount) return;

    const absoluteAmount = Math.abs(amount);
    const twdAmount = convertAmount(absoluteAmount, currency, "TWD");
    const accountAmount = account ? convertAmount(absoluteAmount, currency, account.currency) : absoluteAmount;
    const isIncome = mode === "income";
    const entryAmount = isIncome ? twdAmount : -twdAmount;
    const entryAccountAmount = isIncome ? accountAmount : -accountAmount;
    const entryOriginal = isIncome ? absoluteAmount : -absoluteAmount;
    const entryTitle = title || note || (isIncome ? `${category}入帳` : `${category}支出`);

    setEntries((current) => [
      {
        item: entryTitle,
        amount: entryAmount,
        accountAmount: entryAccountAmount,
        currency,
        meta: `${modeLabel} · ${category} · ${owner} · ${time}`,
        account: account?.name,
        kind: mode,
        occurredAt,
        originalAmount: entryOriginal,
      },
      ...current,
    ]);

    if (isIncome) {
      applyIncomeToAccountBalance(accountId, accountAmount);
    } else {
      setCategories((current) => addExpenseToCategories(current, category, twdAmount));
      applyExpenseToAccountBalance(accountId, accountAmount);
    }

    if (intent === "again") {
      formElement.reset();
      return;
    }

    setModal(null);
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "新帳戶");
    const type = String(form.get("type") || "現金");
    const owner = normalizeOwner(String(form.get("owner") || "Oscar"));
    const kind = parseAccountKind(form.get("kind"));
    const balance = Number(form.get("balance") || 0);
    const currency = String(form.get("currency") || "TWD");

    setAccounts((current) => [
      normalizeFinancialAccount({
        id: `${Date.now()}-${name}`,
        name,
        type,
        owner,
        kind,
        balance,
        currency,
        sourceApp: "manual",
      }),
      ...current,
    ]);
    setModal(null);
  }

  function editAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAccount) return;

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || editingAccount.name);
    const type = String(form.get("type") || editingAccount.type);
    const owner = String(form.get("owner") || editingAccount.owner);
    const kind = parseAccountKind(form.get("kind") || editingAccount.kind);
    const currency = String(form.get("currency") || editingAccount.currency);

    setAccounts((current) =>
      current.map((account) =>
        account.id === editingAccount.id
          ? normalizeFinancialAccount({ ...account, name, type, owner, kind, balance: account.balance, currency })
          : account
      )
    );
    setEditingAccount(null);
    setModal(null);
  }

  function openEditEntry(index: number) {
    setEditingEntryIndex(index);
    setModal("entry-edit");
  }

  function editEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingEntryIndex === null) return;

    const form = new FormData(event.currentTarget);
    const accountId = String(form.get("accountId") || "");
    const account = accounts.find((item) => item.id === accountId);
    const previousEntry = entries[editingEntryIndex];

    if (!previousEntry || !account) return;

    const amount = Math.abs(Number(form.get("amount") || 0));
    if (amount <= 0) return;

    const category = String(form.get("category") || getEntryCategory(previousEntry));
    const currency = normalizeEntryCurrency(form.get("currency") || previousEntry.currency);
    const twdAmount = convertAmount(amount, currency, "TWD");
    const accountAmount = convertAmount(amount, currency, account.currency);
    const owner = String(form.get("owner") || getEntryOwner(previousEntry));
    const occurredAt = String(form.get("time") || previousEntry.occurredAt || getLocalDatetimeInputValue());
    const title = String(form.get("title") || "").trim() || previousEntry.item;
    const time = formatEntryTime(occurredAt);
    const nextEntry: RecentEntry = {
      ...previousEntry,
      item: title,
      amount: -twdAmount,
      accountAmount: -accountAmount,
      currency,
      meta: `${entryModeLabels.expense} · ${category} · ${owner} · ${time}`,
      account: account.name,
      kind: "expense",
      occurredAt,
      originalAmount: -amount,
    };

    reverseEntryAccountImpact(previousEntry);
    adjustExpenseAccountByName(account.name, accountAmount, 1);
    setCategories((current) => adjustExpenseCategory(current, category, twdAmount));
    setEntries((current) => current.map((entry, index) => (index === editingEntryIndex ? nextEntry : entry)));
    setEditingEntryIndex(null);
    setSelectedAccount(account);
    setModal("account-detail");
  }

  function deleteAccount(account: FamilyAccount) {
    const accountIsUsed = entries.some((entry) => entry.account === account.name);
    const message = accountIsUsed
      ? `「${account.name}」已有記帳紀錄引用，刪除後舊紀錄會保留帳戶名稱。確定刪除？`
      : `確定刪除「${account.name}」？`;

    if (!window.confirm(message)) return;

    setAccounts((current) => current.filter((item) => item.id !== account.id));
  }

  function deleteEntry(index: number) {
    const entry = entries[index];
    if (!entry) return;

    reverseEntryAccountImpact(entry);
    setEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
  }

  function toggleAccountHidden(accountId: string) {
    setAccounts((current) =>
      current.map((account) => (account.id === accountId ? { ...account, hidden: !account.hidden } : account))
    );
  }

  function openEditAccount(account: FamilyAccount) {
    setEditingAccount(account);
    setModal("account-edit");
  }

  function importAccounts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawCsv = String(form.get("accounts") || "");
    const importedAccounts = rawCsv
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.toLowerCase().startsWith("name,"))
      .map((line, index) => {
        const [name, type = "現金", owner = "Oscar", kind = "asset", balance = "0", currency = "TWD"] = line
          .split(",")
          .map((part) => part.trim());

        if (!name) return null;

        return normalizeFinancialAccount({
          id: `import-${Date.now()}-${index}-${name}`,
          name,
          type,
          owner,
          kind: parseAccountKind(kind),
          balance: Number(balance) || 0,
          currency: currency || "TWD",
          sourceApp: "andromoney",
          sourceAccountName: name,
        } satisfies FamilyAccount);
      })
      .filter((account): account is FamilyAccount => Boolean(account));

    if (!importedAccounts.length) return;

    const shouldReplace = form.get("replace") === "on";

    setAccounts((current) => (shouldReplace ? importedAccounts : [...importedAccounts, ...current]));
    setModal(null);
  }

  function transferBetweenAccounts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fromId = String(form.get("fromId"));
    const toId = String(form.get("toId"));
    const amount = Number(form.get("amount") || 0);
    const note = String(form.get("note") || "帳戶轉帳");

    if (!amount || fromId === toId) return;

    const fromAccount = accounts.find((account) => account.id === fromId);
    const toAccount = accounts.find((account) => account.id === toId);

    setAccounts((current) =>
      current.map((account) => {
        if (account.id === fromId) {
          const nextBalance =
            account.kind === "asset" ? account.balance - amount : account.balance + amount;
          return { ...account, balance: nextBalance };
        }

        if (account.id === toId) {
          const nextBalance =
            account.kind === "asset" ? account.balance + amount : account.balance - amount;
          return { ...account, balance: nextBalance };
        }

        return account;
      })
    );
    setEntries((current) => [
      {
        item: note,
        amount: 0,
        meta: `轉帳 · ${fromAccount?.name ?? "來源帳戶"} → ${toAccount?.name ?? "目標帳戶"} · 剛剛`,
        account: "帳戶轉帳",
        kind: "transfer",
        occurredAt: getLocalDatetimeInputValue(),
      },
      ...current,
    ]);
    setModal(null);
  }

  function addTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setTodos((current) => [
      {
        title: String(form.get("title") || "新的提醒"),
        owner: normalizeOwner(String(form.get("owner") || "Oscar")),
        due: String(form.get("due") || "未指定"),
        done: false,
      },
      ...current,
    ]);
    setModal(null);
  }

  function addBill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBills((current) => [
      {
        name: String(form.get("name") || "新帳單"),
        amount: Number(form.get("amount") || 0),
        date: String(form.get("date") || "未指定"),
        status: "未繳",
      },
      ...current,
    ]);
    setModal(null);
  }

  function addMaintenance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMaintenance((current) => [
      {
        name: String(form.get("name") || "新保養項目"),
        detail: String(form.get("detail") || "尚未填寫細節"),
        urgency: String(form.get("urgency") || "待安排"),
        completed: false,
      },
      ...current,
    ]);
    setModal(null);
  }

  function resetDemoData() {
    if (!window.confirm("確定重置為初始帳戶與測試資料？這會覆蓋目前帳戶列表並同步到雲端。")) return;

    setAccounts(initialAccounts.map(normalizeFinancialAccount));
    setCategories(initialCategories);
    setTodos(initialTodos);
    setBills(initialBills);
    setMaintenance(initialMaintenance);
    setEntries(initialEntries);
    window.localStorage.removeItem(storageKey);
  }

  const balance = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.amount, 154280);
  }, [entries]);
  const nextTodo = todos.find((item) => !item.done);
  const nextBill = bills.find((item) => item.status !== "已繳");
  const nextMaintenance = maintenance.find((item) => !item.completed);
  const isHomePage = activePage === "home";
  const isLedgerPage = activePage === "ledger";
  const isAccountsPage = activePage === "accounts";
  const isRemindersPage = activePage === "reminders";
  const pageTitle: Record<DashboardPage, string> = {
    home: "家庭中控",
    ledger: "流水",
    accounts: "帳戶與資產",
    reminders: "提醒",
  };
  const showAccounts = isAccountsPage;
  const showLedger = isLedgerPage;
  const showReminders = isRemindersPage;
  const showSecondaryColumn = isLedgerPage || isRemindersPage;
  const showMainContent = showAccounts || showLedger || showReminders || showSecondaryColumn;

  useEffect(() => {
    const sentinel = accountSwitcherSentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowAccountSwitcher(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0,
        rootMargin: "-12% 0px -72% 0px",
      }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [showAccounts]);

  return (
    <main className="min-h-screen bg-[#faf7f0] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden border-r-2 border-slate-950 bg-[#7bdff2] px-5 py-6 lg:block">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-lg bg-[#ff3d9a] text-lg font-black text-white shadow-[5px_5px_0_#fff45f]">
              家
            </div>
            <div>
              <p className="text-lg font-black tracking-normal">家庭中控</p>
              <p className="text-xs font-medium text-slate-600">Home Ledger PWA</p>
            </div>
          </div>

          <nav className="mt-9 space-y-1 text-sm font-semibold">
            {navItems.slice(0, 2).map((item) => {
              const isActive = item.page === activePage;

              return (
                <Link
                  className={`flex items-center justify-between rounded-md px-3 py-2.5 ${
                    isActive
                      ? "bg-[#ff3d9a] text-white shadow-[4px_4px_0_#fff45f]"
                      : "text-slate-800 hover:bg-[#fff45f] hover:text-slate-950"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                  {isActive ? <span className="size-2 rounded-full bg-white" /> : null}
                </Link>
              );
            })}
            <button
              className="flex w-full items-center justify-between rounded-md border-2 border-slate-950 bg-[#fff45f] px-3 py-2.5 text-sm font-black text-slate-950 shadow-[4px_4px_0_#ff3d9a]"
              onClick={() => setModal("entry")}
              type="button"
            >
              記一筆
              <span className="size-2 rounded-full bg-[#ff3d9a]" />
            </button>
            {navItems.slice(2).map((item) => {
              const isActive = item.page === activePage;

              return (
                <Link
                  className={`flex items-center justify-between rounded-md px-3 py-2.5 ${
                    isActive
                      ? "bg-[#ff3d9a] text-white shadow-[4px_4px_0_#fff45f]"
                      : "text-slate-800 hover:bg-[#fff45f] hover:text-slate-950"
                  }`}
                  href={item.href}
                  key={item.label}
                >
                  {item.label}
                  {isActive ? <span className="size-2 rounded-full bg-white" /> : null}
                </Link>
              );
            })}
          </nav>

          <div id="settings" className="mt-10 rounded-lg border-2 border-slate-950 bg-white p-4 shadow-[6px_6px_0_#ff8c42]">
            <p className="text-xs font-bold uppercase text-slate-500">登入狀態</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">Supabase 帳號密碼登入</p>
            <p className="mt-1 break-all text-xs leading-5 text-slate-600">{userEmail}</p>
            <p className="mt-3 text-xs font-bold text-slate-500">帳戶同步</p>
            {accountSyncLabel(accountSyncState) ? (
              <p className={`mt-3 rounded-md px-2 py-1 text-xs font-bold ${accountSyncBadgeClass(accountSyncState)}`}>
                {accountSyncLabel(accountSyncState)}
              </p>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {accountSyncMessage}
            </p>
            <p className="mt-3 text-xs font-bold text-slate-500">提醒 / 流水同步</p>
            <p className={`mt-1 rounded-md px-2 py-1 text-xs font-bold ${accountSyncBadgeClass(dashboardSyncState)}`}>
              {accountSyncLabel(dashboardSyncState)}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {dashboardSyncMessage}
            </p>
            <button
              className="mt-3 w-full rounded-md border-2 border-slate-950 bg-[#25f4a3] px-3 py-2 text-xs font-black text-slate-950 hover:bg-[#7dffcb]"
              onClick={resetDemoData}
              type="button"
            >
              重置測試資料
            </button>
          </div>

          <form action={logout} className="mt-6">
            <button
              className="w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black text-slate-950 hover:bg-[#fff45f]"
              type="submit"
            >
              登出
            </button>
          </form>
        </aside>

        <section className="flex-1 pb-32 lg:pb-0">
          <header
            id="overview"
            className="sticky top-0 z-10 border-b-2 border-[#ff3d9a] bg-[#faf7f0]/90 px-4 py-3 backdrop-blur lg:px-8 lg:py-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">2026 年 5 月</p>
                <h1 className="mt-1 text-2xl font-black tracking-normal text-slate-950 md:text-3xl">
                  {pageTitle[activePage]}
                </h1>
              </div>
              <form action={logout} className="lg:hidden">
                <button
                  className="rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black text-slate-950 shadow-[3px_3px_0_#00c2ff]"
                  type="submit"
                >
                  登出
                </button>
              </form>
            </div>
          </header>

          <div className="px-4 py-4 lg:px-8 lg:py-7">
            {isHomePage && (
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="rounded-lg border-2 border-slate-950 bg-[#ff3d9a] p-4 text-white shadow-[10px_10px_0_#00c2ff] md:p-5">
                <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.95fr)_minmax(280px,1.05fr)] 2xl:items-stretch">
                  <div className="flex min-w-0 flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#fff45f]">所有資產總額</p>
                          <h2 className="mt-2 text-3xl font-black tracking-normal md:text-4xl">{formatCurrency(assetTotal)}</h2>
                        </div>
                        <span className="rounded-md border border-slate-950 bg-[#fff45f] px-2.5 py-1 text-xs font-black text-slate-950">
                          {accountSyncLabel(accountSyncState)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-bold text-white/85">
                        淨資產 {formatCurrency(netAssets)} · 負債 {formatCurrency(liabilityTotal)}
                      </p>
                    </div>

                    <div className="mt-5">
                      <button
                        className="min-h-12 w-full rounded-md border-2 border-slate-950 bg-[#fff45f] px-3 py-2 text-sm font-black text-slate-950 shadow-[3px_3px_0_#111827]"
                        onClick={() => setModal("entry")}
                        type="button"
                      >
                        記一筆
                      </button>
                    </div>
                  </div>

                  <AssetTrendChart
                    key={assetTrendRange}
                    points={assetTrendPoints}
                    range={assetTrendRange}
                    onRangeChange={setAssetTrendRange}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <FocusItem
                  label="提醒"
                  title={nextTodo?.title ?? "今天沒有一般提醒"}
                  meta={nextTodo ? `${nextTodo.owner} · ${nextTodo.due}` : "目前沒有待處理"}
                />
                <FocusItem
                  label="帳單"
                  title={nextBill?.name ?? "沒有待繳帳單"}
                  meta={nextBill ? `${nextBill.date} · ${formatCurrency(nextBill.amount)}` : "目前沒有待繳"}
                />
                <FocusItem
                  label="保養"
                  title={nextMaintenance?.name ?? "沒有保養提醒"}
                  meta={nextMaintenance ? `${nextMaintenance.urgency} · ${nextMaintenance.detail}` : "目前沒有待處理"}
                />
              </div>
            </section>
            )}

            {isHomePage && (
            <section className="mt-4 grid gap-3 md:grid-cols-3">
                <MetricCard label="淨資產" value={formatCurrency(netAssets)} note={`${formatCurrency(assetTotal)} 資產 · ${formatCurrency(liabilityTotal)} 負債`} />
                <MetricCard
                  label="本月支出"
                  value={formatCurrency(totalSpent)}
                  note={`剩餘預算 ${formatCurrency(remainingBudget)}`}
                />
                <MetricCard
                  label="提醒總覽"
                  value={`${openTodos + openBills + openMaintenance} 件`}
                  note={`${openTodos} 提醒 · ${openBills} 帳單 · ${openMaintenance} 保養`}
                />
              </section>
            )}

            {showMainContent && (
            <div className={`mt-5 grid gap-5 ${showSecondaryColumn ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}>
            <div className="flex flex-col gap-5">

              {showAccounts && (
              <section id="accounts" className="order-2 scroll-mt-6 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-[8px_8px_0_#00c2ff]">
                {accountId ? (
                  <div className="space-y-4">
                    <Link
                      className="inline-flex items-center gap-1 rounded-md border-2 border-slate-950 bg-white px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-[#fff45f]"
                      href="/accounts"
                    >
                      ← 返回帳戶列表
                    </Link>
                    {currentSelectedAccount ? (
                      <AccountDetail
                        account={currentSelectedAccount}
                        entries={selectedAccountEntries}
                        onDeleteEntry={deleteEntry}
                        onEditAccount={openEditAccount}
                        onEditEntry={openEditEntry}
                      />
                    ) : (
                      <div className="rounded-md border-2 border-dashed border-slate-950 bg-[#fff7ad] p-5 text-center text-sm font-black text-slate-600">
                        找不到此帳戶（id：{accountId}）。請返回列表選擇其他帳戶。
                      </div>
                    )}
                  </div>
                ) : (
                <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">帳戶與資產</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">追蹤現金、銀行、信用卡、房貸等餘額；轉帳不計入收支。</p>
                  </div>
                  <div className="flex gap-2">
                    <button
	                      className="rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black text-slate-950 hover:bg-[#e9fbff]"
                      onClick={() => setModal("account-import")}
                      type="button"
                    >
                      匯入
                    </button>
                    <button
	                      className="rounded-md border-2 border-slate-950 bg-[#00c2ff] px-3 py-2 text-sm font-black text-slate-950 hover:bg-[#69dbff]"
                      onClick={() => setModal("transfer")}
                      type="button"
                    >
                      轉帳
                    </button>
                    <button
	                      className="rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white hover:bg-[#e92b87]"
                      onClick={() => setModal("account")}
                      type="button"
                    >
                      新增帳戶
                    </button>
                  </div>
                </div>

                <div
                  className={`fixed inset-x-4 top-[4.75rem] z-30 border-b-2 border-slate-950 bg-[#faf7f0]/95 py-2 backdrop-blur transition-all duration-300 lg:inset-x-8 lg:top-[5.75rem] ${
                    showAccountSwitcher ? 'translate-y-0 opacity-100 shadow-[0_12px_0_#ff3d9a]' : 'pointer-events-none -translate-y-3 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {personalAccountTabs.map((tab) => {
                      const isActive = tab.owner === activeAccountOwner;
                      const tabAccounts = accounts.filter((account) => account.owner === tab.owner && !account.hidden);

                      return (
                        <button
                          aria-pressed={isActive}
                          className={`min-h-12 border-b-4 px-3 py-2 text-left transition ${
                            isActive
                              ? "border-[#ff3d9a] bg-[#ff3d9a] text-white shadow-[4px_4px_0_#111827]"
                              : "border-transparent bg-white text-slate-950 hover:border-slate-950 hover:bg-[#fff7ad]"
                          }`}
                          key={tab.owner}
                          onClick={() => setActiveAccountOwner(tab.owner)}
                          type="button"
                        >
                          <span className="block text-base font-black">{tab.label}</span>
                          <span className={`mt-0.5 block text-xs font-bold ${isActive ? "text-white/85" : "text-slate-500"}`}>
                            {tabAccounts.length} 個個人帳戶
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {showAccountSwitcher ? (
                  <div className="h-[4.75rem] lg:h-[5.75rem]" aria-hidden="true" />
                ) : null}

                <div ref={accountSwitcherSentinelRef} className="h-px" aria-hidden="true" />

                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <label className="block">
                    <span className="sr-only">搜尋帳戶</span>
                    <input
                      className="ios-search-input w-full rounded-md border-2 border-slate-950 bg-[#e9fbff] px-3 py-2 font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-[#ff8c42]"
                      onChange={(event) => setAccountQuery(event.target.value)}
                      placeholder="搜尋帳戶、類型、幣別或歸屬"
                      type="search"
                      value={accountQuery}
                    />
                  </label>
	                  <label className="flex items-center gap-2 rounded-md border-2 border-slate-950 bg-[#fff7ad] px-3 py-2 text-sm font-black text-slate-950">
                    <input
                      checked={hideZeroAccounts}
                      className="size-4"
                      onChange={(event) => setHideZeroAccounts(event.target.checked)}
                      type="checkbox"
                    />
                    隱藏零額
                  </label>
	                  <label className="flex items-center gap-2 rounded-md border-2 border-slate-950 bg-[#fff7ad] px-3 py-2 text-sm font-black text-slate-950">
                    <input
                      checked={showHiddenAccounts}
                      className="size-4"
                      onChange={(event) => setShowHiddenAccounts(event.target.checked)}
                      type="checkbox"
                    />
                    顯示隱藏
                  </label>
                </div>

                <div className="mt-3 text-xs font-black text-slate-500">
                  顯示 {visibleAccountsCount} / {accounts.length} 個帳戶 · {activeAccountTab.label}名下帳戶
                  {hiddenAccountsCount ? ` · 已隱藏 ${hiddenAccountsCount} 個` : ""}
                </div>

                <div className="mt-5 space-y-6">
                  <AccountSection
                    accounts={personalAccounts}
                    emptyMessage={`找不到符合條件的${activeAccountTab.label}個人帳戶。`}
                    groups={sortedPersonalAccountGroups}
                    onDelete={deleteAccount}
                    onEdit={openEditAccount}
                    onToggleHidden={toggleAccountHidden}
                    title={`${activeAccountTab.label}的帳戶`}
                  />
                </div>
                </>
                )}
              </section>
              )}

              {showLedger && (
              <section id="ledger" className="order-1 scroll-mt-6 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-[8px_8px_0_#25f4a3]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black">流水總覽</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">Oscar 與 Livia 的家庭記錄會一起同步在這裡。</p>
                  </div>
                  <button
                    className="rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2 text-sm font-black text-white hover:bg-[#e92b87]"
                    onClick={() => setModal("entry")}
                    type="button"
                  >
                    新增一筆
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  {categories.map((item) => (
                    <div key={item.name}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="font-bold">{item.name}</span>
                        <span className="font-black text-slate-600">{formatCurrency(item.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[#e9fbff]">
                        <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              )}

              {showReminders && (
              <section className="order-3">
                <Panel title="提醒" action="新增提醒" id="reminders" onAction={() => setModal("todo")}>
                  <div className="space-y-3">
                    {todos.map((item, index) => (
                      <button
                        className="flex w-full gap-3 rounded-md border-2 border-slate-950 bg-[#fff7ad] p-3 text-left hover:bg-[#e9fbff]"
                        key={`${item.title}-${index}`}
                        onClick={() =>
                          setTodos((current) =>
                            current.map((todo, todoIndex) =>
                              todoIndex === index ? { ...todo, done: !todo.done } : todo
                            )
                          )
                        }
                        type="button"
                      >
                        <span
                          className={`mt-1 size-4 shrink-0 rounded border ${
                            item.done ? "border-slate-950 bg-[#25f4a3]" : "border-slate-950 bg-white"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm font-black ${item.done ? "text-slate-400 line-through" : ""}`}>
                            {item.title}
                          </span>
                          <span className="mt-1 block text-xs font-bold text-slate-500">
                            一般提醒 · {item.owner} · {item.due}
                          </span>
                        </span>
                      </button>
                    ))}

                    {bills.map((item, index) => (
                      <div
                        className="flex items-center justify-between gap-4 rounded-md border-2 border-slate-950 bg-[#e9fbff] p-3"
                        key={`${item.name}-${index}`}
                      >
                        <div>
                          <p className={`text-sm font-black ${item.status === "已繳" ? "text-slate-400 line-through" : ""}`}>
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs font-bold text-slate-500">
                            帳單提醒 · {item.date} · {item.status}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <p className="text-sm font-black">{formatCurrency(item.amount)}</p>
                          <button
                            className="rounded-md border-2 border-slate-950 bg-[#25f4a3] px-2 py-1 text-xs font-black text-slate-950 hover:bg-[#7dffcb]"
                            onClick={() =>
                              setBills((current) =>
                                current.map((bill, billIndex) =>
                                  billIndex === index
                                    ? { ...bill, status: bill.status === "已繳" ? "未繳" : "已繳" }
                                    : bill
                                )
                              )
                            }
                            type="button"
                          >
                            {item.status === "已繳" ? "復原" : "已繳"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </section>
              )}
            </div>

            {showSecondaryColumn && (
            <div className="space-y-5">
              {isLedgerPage && (
              <section className="rounded-lg border-2 border-slate-950 bg-[#00c2ff] p-5 text-slate-950 shadow-[8px_8px_0_#ff3d9a]">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Family Balance</p>
                <h2 className="mt-3 text-3xl font-black">{formatCurrency(balance)}</h2>
                <p className="mt-2 text-sm font-bold text-slate-800">Oscar 與 Livia 的現金流、信用卡與即將扣款都集中在這裡看。</p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border-2 border-slate-950 bg-white p-3">
                    <p className="font-bold text-slate-600">本月收入</p>
                    <p className="mt-1 font-black text-emerald-700">{formatCurrency(126500)}</p>
                  </div>
                  <div className="rounded-md border-2 border-slate-950 bg-white p-3">
                    <p className="font-bold text-slate-600">固定支出</p>
                    <p className="mt-1 font-black text-[#c51f72]">{formatCurrency(52699)}</p>
                  </div>
                </div>
              </section>
              )}

              {isRemindersPage && (
              <Panel title="保養提醒" action="新增項目" id="maintenance" onAction={() => setModal("maintenance")}>
                <div className="space-y-3">
                  {maintenance.map((item, index) => (
	                    <div className="rounded-md border-2 border-slate-950 bg-[#fff7ad] p-3" key={`${item.name}-${index}`}>
                      <div className="flex items-center justify-between gap-3">
	                        <p className={`text-sm font-black ${item.completed ? "text-slate-400 line-through" : ""}`}>
                          {item.name}
                        </p>
	                        <span className="rounded-full bg-[#00c2ff] px-2.5 py-1 text-xs font-black text-slate-950">
                          {item.urgency}
                        </span>
                      </div>
	                      <p className="mt-1 text-xs font-bold text-slate-600">{item.detail}</p>
                      <button
	                        className="mt-3 rounded-md border-2 border-slate-950 bg-white px-2 py-1 text-xs font-black text-slate-950 hover:bg-[#25f4a3]"
                        onClick={() =>
                          setMaintenance((current) =>
                            current.map((task, taskIndex) =>
                              taskIndex === index ? { ...task, completed: !task.completed } : task
                            )
                          )
                        }
                        type="button"
                      >
                        {item.completed ? "復原" : "完成"}
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
              )}

              {isLedgerPage && (
              <Panel title="最近流水" action="查看全部" onAction={() => setModal("entries")}>
                <RecentEntries
                  entries={sortedEntries.slice(0, 4)}
                  onDelete={(originalIndex) => setEntries((current) => current.filter((_, entryIndex) => entryIndex !== originalIndex))}
                />
              </Panel>
              )}
            </div>
            )}
            </div>
            )}
          </div>
        </section>
      </div>

      {modal === "entry" && (
        <EntryComposer
          accounts={selectableAccounts}
          categories={categories}
          onClose={() => setModal(null)}
          onSubmit={addEntry}
          onSwitchToTransfer={() => setModal("transfer")}
        />
      )}
      {modal === "account" && (
        <Modal title="新增帳戶" onClose={() => setModal(null)}>
          <AccountForm onSubmit={addAccount} />
        </Modal>
      )}
      {modal === "account-edit" && editingAccount && (
        <Modal
          title="編輯帳戶"
          onClose={() => {
            setEditingAccount(null);
            setModal(null);
          }}
        >
          <AccountForm account={editingAccount} onSubmit={editAccount} submitLabel="儲存帳戶" />
        </Modal>
      )}
      {!accountId && modal === "account-detail" && currentSelectedAccount && (
        <Modal
          title="帳戶明細"
          onClose={() => {
            setSelectedAccount(null);
            setModal(null);
          }}
        >
          <AccountDetail
            account={currentSelectedAccount}
            entries={selectedAccountEntries}
            onDeleteEntry={deleteEntry}
            onEditAccount={openEditAccount}
            onEditEntry={openEditEntry}
          />
        </Modal>
      )}
      {modal === "entry-edit" && editingEntry && (
        <Modal
          title="修改紀錄"
          onClose={() => {
            setEditingEntryIndex(null);
            setModal(!accountId && currentSelectedAccount ? "account-detail" : null);
          }}
        >
          <EntryEditForm
            accounts={selectableAccounts}
            categories={categories}
            entry={editingEntry}
            onSubmit={editEntry}
          />
        </Modal>
      )}
      {modal === "account-import" && (
        <Modal title="批次匯入帳戶" onClose={() => setModal(null)}>
          <AccountImportForm onSubmit={importAccounts} />
        </Modal>
      )}
      {modal === "transfer" && (
        <Modal title="帳戶轉帳" onClose={() => setModal(null)}>
          <TransferForm accounts={selectableAccounts} onSubmit={transferBetweenAccounts} />
        </Modal>
      )}
      {modal === "todo" && (
        <Modal title="新增提醒" onClose={() => setModal(null)}>
          <TodoForm onSubmit={addTodo} />
        </Modal>
      )}
      {modal === "bill" && (
        <Modal title="新增帳單提醒" onClose={() => setModal(null)}>
          <BillForm onSubmit={addBill} />
        </Modal>
      )}
      {modal === "maintenance" && (
        <Modal title="新增保養提醒" onClose={() => setModal(null)}>
          <MaintenanceForm onSubmit={addMaintenance} />
        </Modal>
      )}
      {modal === "entries" && (
        <Modal title="全部流水" onClose={() => setModal(null)}>
          <RecentEntries
            entries={sortedEntries}
            onDelete={deleteEntry}
            onEdit={openEditEntry}
          />
        </Modal>
      )}
    </main>
  );
}

function AccountSection({
  title,
  accounts,
  groups,
  emptyMessage,
  onToggleHidden,
  onEdit,
  onDelete,
}: {
  title: string;
  accounts: FamilyAccount[];
  groups: [string, FamilyAccount[]][];
  emptyMessage: string;
  onToggleHidden: (accountId: string) => void;
  onEdit: (account: FamilyAccount) => void;
  onDelete: (account: FamilyAccount) => void;
}) {
  const router = useRouter();
  return (
    <section className="rounded-lg border-2 border-slate-950 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#ff3d9a] pb-3">
        <div>
          <h3 className="text-base font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">依帳戶類型分組顯示</p>
        </div>
        <span className="rounded-md bg-[#e9fbff] px-2.5 py-1 text-xs font-black text-slate-700">
          {accounts.length} 個帳戶 · 小計 {formatCurrency(accountNetTotal(accounts))}
        </span>
      </div>

      <div className="space-y-5">
        {groups.map(([group, groupAccounts]) => (
          <div key={group}>
            <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <h4 className="text-sm font-black text-slate-950">{group}</h4>
              <span className="text-right text-xs font-black text-slate-500">
                {groupAccounts.length} 個帳戶 · 小計 {formatCurrency(accountNetTotal(groupAccounts))}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {groupAccounts.map((account) => (
                <div
                  aria-label={`查看 ${account.name} 的紀錄`}
                  className={`cursor-pointer rounded-md border p-3 transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_#111827] focus:outline-none focus:ring-4 focus:ring-[#ff8c42] ${
                    account.hidden
                      ? "border-dashed border-slate-300 bg-slate-100 opacity-70"
                      : "border-slate-950 bg-[#fff7ad]"
                  }`}
                  key={account.id}
                  onClick={() => router.push(`/accounts/${account.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/accounts/${account.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black">{account.name}</p>
                        {account.hidden ? (
                          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black text-slate-600">
                            已隱藏
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {account.type} · {account.owner} · {account.currency}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-black ${
                          account.kind === "asset" ? "bg-[#25f4a3] text-slate-950" : "bg-[#ff8c42] text-slate-950"
                        }`}
                      >
                        {accountSideLabel(account.kind)}
                      </span>
                      <button
                        className="inline-flex size-9 items-center justify-center rounded-[0.9rem] border-2 border-slate-950 bg-white text-slate-500 shadow-[3px_3px_0_#ff8c42] transition hover:bg-[#e9fbff] hover:text-[#15957d]"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(account);
                        }}
                        type="button"
                        aria-label={`編輯 ${account.name}`}
                        title="編輯帳戶"
                      >
                        <HexEditIcon />
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <p
                      className={`min-w-0 text-xl font-black ${
                        getDisplayAccountBalance(account) < 0 ? "text-[#c9563f]" : "text-slate-950"
                      }`}
                    >
                      {formatAccountBalance(account)}
                    </p>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        aria-label={account.hidden ? `顯示 ${account.name}` : `隱藏 ${account.name}`}
                        className="inline-flex items-center gap-1 rounded-md border-2 border-slate-950 bg-white px-2 py-1 text-xs font-black text-slate-950 hover:bg-[#e9fbff]"
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleHidden(account.id);
                        }}
                        title={account.hidden ? "顯示帳戶" : "隱藏帳戶"}
                        type="button"
                      >
                        {account.hidden ? "顯示" : "隱藏"}
                      </button>
                      <button
                        className="rounded-md border-2 border-[#ff3d9a] bg-white px-2 py-1 text-xs font-black text-[#c51f72] hover:bg-[#ffe1f0]"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(account);
                        }}
                        type="button"
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {!accounts.length && (
          <div className="rounded-md border-2 border-dashed border-slate-950 bg-[#fff7ad] p-5 text-center text-sm font-black text-slate-500">
            {emptyMessage}
          </div>
        )}
      </div>
    </section>
  );
}

function AccountDetail({
  account,
  entries,
  onEditAccount,
  onEditEntry,
  onDeleteEntry,
}: {
  account: FamilyAccount;
  entries: Array<{ entry: RecentEntry; index: number }>;
  onEditAccount: (account: FamilyAccount) => void;
  onEditEntry: (index: number) => void;
  onDeleteEntry: (index: number) => void;
}) {
  const expenseTotal = entries
    .filter(({ entry }) => entry.kind === "expense" || entry.amount < 0)
    .reduce((sum, { entry }) => sum + Math.abs(entry.amount), 0);
  const transferCount = entries.filter(({ entry }) => entry.kind === "transfer").length;

  return (
    <div className="space-y-4">
      <section className="rounded-md border-2 border-slate-950 bg-white p-4 shadow-[6px_6px_0_#00c2ff]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-slate-500">帳戶</p>
              <h3 className="mt-1 break-words text-xl font-black text-slate-950">{account.name}</h3>
              <p className="mt-1 text-sm font-bold text-slate-600">
                {account.type} · {account.owner} · {account.currency} · {accountSideLabel(account.kind)}
              </p>
            </div>
            <button
              className="inline-flex size-10 items-center justify-center rounded-[1rem] border-2 border-slate-950 bg-[#fbfaf7] text-slate-500 shadow-[3px_3px_0_#ff8c42] transition hover:bg-[#e9fbff] hover:text-[#15957d]"
              onClick={() => onEditAccount(account)}
              type="button"
              aria-label="編輯帳戶"
              title="編輯帳戶"
            >
              <HexEditIcon />
              <span className="sr-only">編輯帳戶</span>
            </button>
          </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className="rounded-md bg-[#fff7ad] px-3 py-2">
            <p className="text-xs font-black text-slate-500">目前餘額</p>
            <p
              className={`mt-1 text-base font-black ${
                getDisplayAccountBalance(account) < 0 ? "text-[#c9563f]" : "text-slate-950"
              }`}
            >
              {formatAccountBalance(account)}
            </p>
          </div>
          <div className="rounded-md bg-[#e9fbff] px-3 py-2">
            <p className="text-xs font-black text-slate-500">相關紀錄</p>
            <p className="mt-1 text-base font-black text-slate-950">{entries.length} 筆</p>
          </div>
          <div className="rounded-md bg-[#25f4a3] px-3 py-2">
            <p className="text-xs font-black text-slate-700">支出合計</p>
            <p className="mt-1 text-base font-black text-slate-950">{formatCurrency(expenseTotal)}</p>
          </div>
        </div>

        {transferCount ? (
          <p className="mt-3 rounded-md border-2 border-slate-950 bg-[#fff7ad] px-3 py-2 text-xs font-black text-slate-700">
            這裡包含 {transferCount} 筆轉帳紀錄。轉帳牽涉兩個帳戶，目前先顯示與刪除，修改請用新增轉帳修正。
          </p>
        ) : null}
      </section>

      <section className="rounded-md border-2 border-slate-950 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-black text-slate-950">這個帳戶的紀錄</h3>
          <span className="rounded-md bg-[#e9fbff] px-2 py-1 text-xs font-black text-slate-600">
            由新到舊
          </span>
        </div>

        {entries.length ? (
          <RecentEntries entries={entries} onDelete={onDeleteEntry} onEdit={onEditEntry} />
        ) : (
          <div className="rounded-md border-2 border-dashed border-slate-950 bg-[#fff7ad] p-5 text-center text-sm font-black text-slate-500">
            這個帳戶目前沒有流水紀錄。
          </div>
        )}
      </section>
    </div>
  );
}

function AssetTrendChart({
  points,
  range,
  onRangeChange,
}: {
  points: AssetTrendPoint[];
  range: AssetTrendRangeKey;
  onRangeChange: (range: AssetTrendRangeKey) => void;
}) {
  const width = 360;
  const height = 220;
  const paddingX = 18;
  const paddingY = 24;
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);
  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = Math.max(maxValue - minValue, 1);
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;
  const coordinates = points.map((point, index) => {
    const x = paddingX + (points.length === 1 ? chartWidth : (index / (points.length - 1)) * chartWidth);
    const y = paddingY + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { ...point, x, y };
  });
  const linePath = coordinates.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${coordinates[coordinates.length - 1].x} ${height - paddingY} L ${coordinates[0].x} ${height - paddingY} Z`;
  const rangeLabel = assetTrendRanges.find((r) => r.key === range)?.label ?? "5年";
  const lastPoint = coordinates[coordinates.length - 1];
  const activePointIndex = hoveredPointIndex ?? coordinates.length - 1;
  const activePoint = coordinates[activePointIndex] ?? lastPoint;
  const selectedDelta = activePoint.value - points[0].value;
  const selectedDeltaIsPositive = selectedDelta >= 0;

  const updateHoveredPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height || coordinates.length === 0) return;

    const pointerX = ((event.clientX - rect.left) / rect.width) * width;
    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    coordinates.forEach((point, index) => {
      const distance = Math.abs(point.x - pointerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    setHoveredPointIndex(nearestIndex);
  };

  const releaseHoveredPoint = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.pointerType !== "mouse") {
      setHoveredPointIndex(null);
    }
  };

  return (
    <div className="rounded-lg border-2 border-slate-950 bg-white p-3 text-slate-950 shadow-[6px_6px_0_#111827]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">資產走勢</p>
          <p className="mt-1 text-sm font-black text-slate-950">最近 {rangeLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-500">{hoveredPointIndex === null ? "目前" : "選取"}</p>
          <p className="text-sm font-black text-slate-950">{formatCompactCurrency(activePoint.value)}</p>
          <p className="text-[11px] font-bold text-slate-500">{activePoint.dateLabel}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {assetTrendRanges.map((r) => {
          const active = r.key === range;
          return (
            <button
              className={`rounded-md border-2 border-slate-950 px-2.5 py-1 text-xs font-black transition ${
                active
                  ? "bg-[#ff3d9a] text-white shadow-[2px_2px_0_#111827]"
                  : "bg-white text-slate-950 hover:bg-[#fff45f]"
              }`}
              key={r.key}
              onClick={() => onRangeChange(r.key)}
              type="button"
            >
              {r.label}
            </button>
          );
        })}
      </div>

      <svg
        aria-label="所有資產金額走勢圖"
        className="mt-3 h-64 w-full cursor-crosshair overflow-visible touch-none"
        preserveAspectRatio="none"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
        onPointerDown={(event) => {
          updateHoveredPoint(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={updateHoveredPoint}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            setHoveredPointIndex(null);
          }
        }}
        onPointerUp={releaseHoveredPoint}
        onPointerCancel={releaseHoveredPoint}
      >
        <defs>
          <linearGradient id="asset-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#25f4a3" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#25f4a3" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#asset-trend-fill)" />
        <path d={linePath} fill="none" stroke="#0f172a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" />
        {lastPoint && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            fill="#fff45f"
            r={hoveredPointIndex === coordinates.length - 1 ? "6.5" : "5"}
            stroke="#0f172a"
            strokeWidth="3"
          />
        )}
        {activePoint && activePointIndex !== coordinates.length - 1 && (
          <>
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={paddingY}
              y2={height - paddingY}
              stroke="#0f172a"
              strokeDasharray="4 4"
              strokeWidth="1.5"
              opacity="0.5"
            />
            <circle cx={activePoint.x} cy={activePoint.y} fill="#0f172a" r="6" stroke="#fff45f" strokeWidth="3" />
          </>
        )}
      </svg>

      <div className="mt-2 grid grid-cols-3 gap-2 text-xs font-black">
        <div className="rounded-md bg-[#e9fbff] px-2 py-1.5">
          <p className="text-slate-500">起點</p>
          <p className="mt-0.5 text-slate-950">{formatCompactCurrency(points[0].value)}</p>
        </div>
        <div className="rounded-md bg-[#fff7ad] px-2 py-1.5">
          <p className="text-slate-500">{hoveredPointIndex === null ? "變動" : "選取"}</p>
          <p className="mt-0.5 text-slate-950">{activePoint.dateLabel}</p>
          <p className={`mt-0.5 ${selectedDeltaIsPositive ? "text-emerald-700" : "text-[#c51f72]"}`}>
            {selectedDeltaIsPositive ? "+" : ""}
            {formatCompactCurrency(selectedDelta)}
          </p>
        </div>
        <div className="rounded-md bg-[#25f4a3] px-2 py-1.5">
          <p className="text-slate-700">現在</p>
          <p className="mt-0.5 text-slate-950">{formatCompactCurrency(points[points.length - 1].value)}</p>
        </div>
      </div>
    </div>
  );
}

function FocusItem({ label, title, meta }: { label: string; title: string; meta: string }) {
  return (
    <article className="rounded-lg border-2 border-slate-950 bg-white p-4 shadow-[6px_6px_0_#ff8c42]">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#c51f72]">{label}</p>
      <p className="mt-2 line-clamp-2 text-sm font-black text-slate-950">{title}</p>
      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-600">{meta}</p>
    </article>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="rounded-lg border-2 border-slate-950 bg-white p-4 shadow-[6px_6px_0_#25f4a3]">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-bold text-slate-600">{note}</p>
    </article>
  );
}

function Panel({
  title,
  action,
  children,
  id,
  onAction,
}: {
  title: string;
  action: string;
  children: ReactNode;
  id?: string;
  onAction: () => void;
}) {
  return (
    <section className="scroll-mt-6 rounded-lg border-2 border-slate-950 bg-white p-5 shadow-[6px_6px_0_#7bdff2]" id={id}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-black">{title}</h2>
        <button
          className="rounded-md border-2 border-slate-950 bg-[#fff45f] px-3 py-1.5 text-xs font-black text-slate-950 hover:bg-[#ff8c42]"
          onClick={onAction}
          type="button"
        >
          {action}
        </button>
      </div>
      {children}
    </section>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-end bg-slate-950/50 p-3 sm:place-items-center" onClick={onClose} role="presentation">
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border-2 border-slate-950 bg-[#fff45f] p-5 shadow-[10px_10px_0_#ff3d9a]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-modal-title"
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="dashboard-modal-title" className="text-lg font-black">{title}</h2>
          <button
            className="rounded-md border-2 border-slate-950 bg-white px-3 py-1.5 text-sm font-black text-slate-950 hover:bg-[#e9fbff]"
            onClick={onClose}
            type="button"
          >
            關閉
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function TextInput({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-slate-800">{label}</span>
      <input
        className="w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-base font-bold text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#00c2ff]"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function SelectInput({
  label,
  name,
  children,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  children: ReactNode;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const controlProps =
    value === undefined
      ? { defaultValue }
      : {
          value,
          onChange: (event: ChangeEvent<HTMLSelectElement>) => onChange?.(event.target.value),
        };

  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-slate-800">{label}</span>
      <select
        className="w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-base font-bold text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#00c2ff]"
        name={name}
        {...controlProps}
      >
        {children}
      </select>
    </label>
  );
}

function SubmitButton({ children }: { children: ReactNode }) {
  return (
    <button className="w-full rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-4 py-2.5 text-sm font-black text-white shadow-[4px_4px_0_#00c2ff]" type="submit">
      {children}
    </button>
  );
}

function EntryComposer({
  accounts,
  categories,
  onClose,
  onSubmit,
  onSwitchToTransfer,
}: {
  accounts: FamilyAccount[];
  categories: Category[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSwitchToTransfer?: () => void;
}) {
  const [formState, setFormState] = useState<EntryFormState>(() => ({
    mode: "expense",
    amount: "",
    currency: defaultEntryCurrency(accounts[0]),
    accountId: accounts[0]?.id ?? "",
    category: categories[0]?.name ?? "其他",
    owner: "Oscar",
    time: getLocalDatetimeInputValue(),
    note: "",
  }));
  const [formError, setFormError] = useState("");

  const selectedAccountId = accounts.some((account) => account.id === formState.accountId)
    ? formState.accountId
    : accounts[0]?.id ?? "";
  const isIncomeMode = formState.mode === "income";
  const incomeCategoryName = "收入";
  const selectedCategory = isIncomeMode
    ? incomeCategoryName
    : categories.some((category) => category.name === formState.category)
      ? formState.category
      : categories[0]?.name ?? "其他";
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const selectedCurrency = normalizeEntryCurrency(formState.currency || defaultEntryCurrency(selectedAccount));
  const amountValue = Math.abs(Number(formState.amount) || 0);
  const activeModeLabel = entryModeLabels[formState.mode];
  const amountPreview = formatCurrencyValue(amountValue, selectedCurrency, {
    minimumFractionDigits: selectedCurrency === "TWD" ? 0 : 2,
    maximumFractionDigits: selectedCurrency === "TWD" ? 0 : 2,
  });

  function updateField<Field extends keyof EntryFormState>(field: Field, value: EntryFormState[Field]) {
    setFormError("");
    setFormState((current) => ({ ...current, [field]: value }));
  }

  function selectMode(mode: EntryMode) {
    setFormError("");
    setFormState((current) => ({
      ...current,
      mode,
      category: mode === "income" ? incomeCategoryName : current.category,
    }));
  }

  function impactLabel() {
    return accountImpactLabelForMode(formState.mode, selectedAccount, amountValue, selectedCurrency);
  }

  function updateAccount(value: string) {
    const nextAccount = accounts.find((account) => account.id === value);
    setFormError("");
    setFormState((current) => ({
      ...current,
      accountId: value,
      currency: defaultEntryCurrency(nextAccount),
    }));
  }

  function submitEntry(event: FormEvent<HTMLFormElement>) {
    if (!selectedAccountId || amountValue <= 0) {
      event.preventDefault();
      setFormError("請先選擇帳戶並輸入金額");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    onSubmit(event);

    if (submitter?.value === "again") {
      setFormState((current) => ({
        ...current,
        amount: "",
        note: "",
        time: getLocalDatetimeInputValue(),
      }));
    }
  }

  return (
    <form
      aria-label="記一筆支出"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#faf7f0] text-slate-950"
      onSubmit={submitEntry}
      role="dialog"
    >
      <input name="mode" type="hidden" value={formState.mode} />
      <header className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b-2 border-slate-950 bg-white px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-[0_8px_0_#00c2ff]">
        <button
          className="min-h-11 rounded-md border-2 border-slate-950 bg-[#25f4a3] px-3 text-sm font-black text-slate-950 shadow-[3px_3px_0_#ff3d9a]"
          onClick={onClose}
          type="button"
        >
          返回
        </button>
        <h2 className="text-center text-xl font-black text-slate-950">記一筆</h2>
        <button
          className="min-h-11 rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-3 text-sm font-black text-white shadow-[3px_3px_0_#25f4a3]"
          name="intent"
          type="submit"
          value="save"
        >
          保存
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-5 pt-4">
        <div className="mx-auto w-full max-w-lg space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-md border-2 border-slate-950 bg-white p-1 shadow-[5px_5px_0_#ff8c42]">
            {entryModes.map((mode) => {
              const isActive = formState.mode === mode.id;
              const isTransfer = mode.id === "transfer";
              const transferReady = isTransfer && Boolean(onSwitchToTransfer);
              const disabled = isTransfer && !transferReady;
              return (
                <button
                  aria-disabled={disabled}
                  aria-pressed={isActive}
                  className={`min-h-10 rounded px-1 text-sm font-black ${
                    isActive
                      ? "bg-[#ff3d9a] text-white shadow-[inset_0_0_0_2px_#0f172a]"
                      : disabled
                        ? "cursor-not-allowed bg-slate-100 text-slate-400"
                        : "bg-white text-slate-700 hover:bg-[#fff7ad]"
                  }`}
                  disabled={disabled}
                  key={mode.id}
                  onClick={() => {
                    if (disabled) return;
                    if (isTransfer) {
                      onSwitchToTransfer?.();
                      return;
                    }
                    selectMode(mode.id);
                  }}
                  title={mode.label}
                  type="button"
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <section className="rounded-md border-2 border-slate-950 bg-white p-4 shadow-[7px_7px_0_#25f4a3]">
            <div className="flex items-center justify-between gap-3 text-xs font-black text-slate-500">
              <span>{activeModeLabel}</span>
              <span>{amountValue > 0 ? amountPreview : formatCurrencyValue(0, selectedCurrency)}</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div
                aria-label="幣別"
                className="inline-flex shrink-0 self-start overflow-hidden rounded-md border-2 border-slate-950 bg-white shadow-[3px_3px_0_#ff3d9a]"
                role="group"
              >
                <input name="currency" type="hidden" value={selectedCurrency} />
                {(["TWD", "USD"] as const).map((currency) => {
                  const isActive = selectedCurrency === currency;
                  return (
                    <button
                      aria-pressed={isActive}
                      className={`min-h-8 px-2.5 text-xs font-black transition sm:min-h-9 sm:px-3 ${
                        isActive
                          ? "bg-[#25f4a3] text-slate-950 shadow-[inset_0_0_0_2px_#0f172a]"
                          : "bg-white text-slate-500 hover:bg-[#fff7ad]"
                      }`}
                      key={currency}
                      onClick={() => updateField("currency", currency)}
                      type="button"
                    >
                      {currency === "TWD" ? "台幣" : "美金"}
                    </button>
                  );
                })}
              </div>
              <label className="min-w-0 flex-1">
                <span className="sr-only">金額</span>
                <input
                  aria-label="金額"
                  className="min-h-24 w-full bg-transparent text-right text-7xl font-black tracking-tight text-slate-950 placeholder:text-slate-300 focus:outline-none sm:min-h-28 sm:text-8xl"
                  inputMode="decimal"
                  onChange={(event) => updateField("amount", event.target.value)}
                  pattern="[0-9]*[.]?[0-9]*"
                  placeholder="0.00"
                  name="amount"
                  type="text"
                  value={formState.amount}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-md border-2 border-slate-950 bg-white p-4 shadow-[7px_7px_0_#00c2ff]">
            {isIncomeMode ? (
              <label className="block">
                <span className="mb-1 block text-sm font-black text-slate-800">分類</span>
                <div className="flex items-center justify-between rounded-md border-2 border-slate-950 bg-[#fff7ad] px-3 py-2 text-base font-black text-slate-950">
                  <span>收入</span>
                  <span className="text-xs font-bold text-slate-500">收入專用分類</span>
                </div>
                <input name="category" type="hidden" value={incomeCategoryName} />
              </label>
            ) : (
              <SelectInput label="分類" name="category" value={selectedCategory} onChange={(value) => updateField("category", value)}>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </SelectInput>
            )}

            <SelectInput label="帳戶" name="accountId" value={selectedAccountId} onChange={updateAccount}>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </SelectInput>

            <label className="block">
              <span className="mb-1 block text-sm font-black text-slate-800">時間</span>
              <input
                className="w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-base font-bold text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#00c2ff]"
                name="time"
                onChange={(event) => updateField("time", event.target.value)}
                type="datetime-local"
                value={formState.time}
              />
            </label>

            <SelectInput label="成員" name="owner" value={formState.owner} onChange={(value) => updateField("owner", value)}>
              <option>Oscar</option>
              <option>Livia</option>
            </SelectInput>

            <label className="block">
              <span className="mb-1 block text-sm font-black text-slate-800">備註</span>
              <textarea
                className="min-h-24 w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-base font-bold text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#00c2ff]"
                name="note"
                onChange={(event) => updateField("note", event.target.value)}
                placeholder="例如：全聯採買"
                value={formState.note}
              />
            </label>
          </section>

          <div className="rounded-md border-2 border-slate-950 bg-[#25f4a3] px-3 py-2 text-xs font-black text-slate-950 shadow-[4px_4px_0_#ff3d9a]">
            {selectedAccount?.name ?? "尚未選擇帳戶"} · {impactLabel()}
          </div>

          {formError && (
            <p className="rounded-md border-2 border-slate-950 bg-[#ff8c42] px-3 py-2 text-sm font-black text-slate-950">
              {formError}
            </p>
          )}
        </div>
      </div>

      <footer className="grid grid-cols-2 gap-2 border-t-2 border-slate-950 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_0_#ff8c42]">
        <button
          className="min-h-12 rounded-md border-2 border-slate-950 bg-[#ff3d9a] px-2 text-sm font-black text-white shadow-[3px_3px_0_#00c2ff]"
          name="intent"
          type="submit"
          value="save"
        >
          保存
        </button>
        <button
          className="min-h-12 rounded-md border-2 border-slate-950 bg-[#00c2ff] px-2 text-sm font-black text-slate-950 shadow-[3px_3px_0_#ff8c42]"
          name="intent"
          type="submit"
          value="again"
        >
          再記一筆
        </button>
      </footer>
    </form>
  );
}

function EntryEditForm({
  entry,
  accounts,
  categories,
  onSubmit,
}: {
  entry: RecentEntry;
  accounts: FamilyAccount[];
  categories: Category[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const fallbackAccountId = accounts.find((account) => account.name === entry.account)?.id ?? accounts[0]?.id ?? "";
  const initialCategory = categories.some((category) => category.name === getEntryCategory(entry))
    ? getEntryCategory(entry)
    : categories[0]?.name ?? "其他";
  const initialOwner = getEntryOwner(entry);
  const initialTime = entry.occurredAt || getLocalDatetimeInputValue();
  const initialCurrency = normalizeEntryCurrency(entry.currency);
  const initialAmount = Math.abs(entry.originalAmount ?? entry.amount);

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextInput defaultValue={entry.item} label="紀錄名稱" name="title" placeholder="例如：全聯採買" />
      <div className="grid grid-cols-[7rem_1fr] gap-2">
        <SelectInput defaultValue={initialCurrency} label="幣別" name="currency">
          <option value="TWD">台幣</option>
          <option value="USD">美金</option>
        </SelectInput>
        <TextInput
          defaultValue={initialAmount}
          label="金額"
          name="amount"
          placeholder="1000"
          type="number"
        />
      </div>
      <SelectInput defaultValue={initialCategory} label="分類" name="category">
        {categories.map((category) => (
          <option key={category.name} value={category.name}>
            {category.name}
          </option>
        ))}
      </SelectInput>
      <SelectInput defaultValue={fallbackAccountId} label="帳戶" name="accountId">
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectInput>
      <TextInput defaultValue={initialTime} label="時間" name="time" type="datetime-local" />
      <SelectInput defaultValue={initialOwner} label="成員" name="owner">
        <option>Oscar</option>
        <option>Livia</option>
      </SelectInput>
      <SubmitButton>儲存紀錄</SubmitButton>
    </form>
  );
}

function AccountForm({
  account,
  onSubmit,
  submitLabel = "加入帳戶",
}: {
  account?: FamilyAccount;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextInput
        defaultValue={account?.name}
        label="帳戶名稱"
        name="name"
        placeholder="例如：玉山信用卡、Oscar 薪轉戶"
      />
      <SelectInput defaultValue={account?.type} label="帳戶類型" name="type">
        {accountTypes.map((type) => (
          <option key={type}>{type}</option>
        ))}
      </SelectInput>
      <SelectInput defaultValue={account?.owner} label="歸屬" name="owner">
        {accountOwners.map((owner) => (
          <option key={owner}>{owner}</option>
        ))}
      </SelectInput>
      <SelectInput defaultValue={account?.kind} label="性質" name="kind">
        <option value="asset">資產</option>
        <option value="liability">負債</option>
      </SelectInput>
      <SelectInput defaultValue={account?.currency} label="幣別" name="currency">
        {accountCurrencies.map((currency) => (
          <option key={currency} value={currency}>
            {currency}
          </option>
        ))}
      </SelectInput>
      {account ? (
        <p className="rounded-md border-2 border-slate-950 bg-[#fff7ad] px-3 py-2 text-xs font-bold text-slate-700">
          目前餘額只保留給帳戶頁面的長按 3 秒隱藏調整。
        </p>
      ) : (
        <TextInput label="目前餘額" name="balance" placeholder="10000" type="number" />
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function HexEditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
      <path
        d="M8.3 4.6h7.4L20 10.2 15.7 19.4H8.3L4 10.2 8.3 4.6Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m9.8 14.3 4.4-4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="m13.7 8.7 1.6 1.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function AccountImportForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <label className="block">
        <span className="mb-1 block text-sm font-black text-slate-800">CSV 帳戶資料</span>
        <textarea
          className="min-h-44 w-full rounded-md border-2 border-slate-950 bg-white px-3 py-2 font-sans text-sm font-bold text-slate-950 focus:outline-none focus:ring-4 focus:ring-[#00c2ff]"
          name="accounts"
          placeholder={"name,type,owner,kind,balance,currency\n玉山銀行,銀行,Oscar,asset,52000,TWD\n玉山信用卡,信用卡,Livia,liability,18600,TWD\nUS現金,現金,Oscar,asset,1689.04,USD"}
          required
        />
      </label>
      <p className="text-xs font-bold leading-5 text-slate-600">
        欄位順序：帳戶名稱、帳戶類型、歸屬、性質、原幣餘額、幣別。性質請填 asset/資產 或 liability/負債。
      </p>
      <label className="flex items-center gap-2 rounded-md border-2 border-slate-950 bg-white px-3 py-2 text-sm font-black text-slate-950">
        <input className="size-4" defaultChecked name="replace" type="checkbox" />
        取代目前帳戶列表
      </label>
      <SubmitButton>匯入帳戶</SubmitButton>
    </form>
  );
}

function TransferForm({
  accounts,
  onSubmit,
}: {
  accounts: FamilyAccount[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <SelectInput label="從哪個帳戶" name="fromId">
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectInput>
      <SelectInput label="轉到哪個帳戶" name="toId">
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </SelectInput>
      <TextInput label="金額" name="amount" placeholder="5000" type="number" />
      <TextInput label="備註" name="note" placeholder="例如：信用卡還款、現金提款（可留空）" required={false} />
      <SubmitButton>完成轉帳</SubmitButton>
    </form>
  );
}

function TodoForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextInput label="提醒內容" name="title" placeholder="例如：確認信用卡明細" />
      <TextInput label="提醒時間" name="due" placeholder="今天、明天、5/15" />
      <SelectInput label="負責人" name="owner">
        <option>Oscar</option>
        <option>Livia</option>
      </SelectInput>
      <SubmitButton>加入提醒</SubmitButton>
    </form>
  );
}

function BillForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextInput label="帳單名稱" name="name" placeholder="例如：水費" />
      <TextInput label="金額" name="amount" placeholder="1200" type="number" />
      <TextInput label="到期日" name="date" placeholder="5/20" />
      <SubmitButton>加入帳單</SubmitButton>
    </form>
  );
}

function MaintenanceForm({ onSubmit }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <TextInput label="項目" name="name" placeholder="例如：洗衣機清潔" />
      <TextInput label="細節" name="detail" placeholder="例如：清洗濾網與槽洗淨" />
      <TextInput label="提醒" name="urgency" placeholder="例如：下週" />
      <SubmitButton>加入保養提醒</SubmitButton>
    </form>
  );
}

function RecentEntries({
  entries,
  onDelete,
  onEdit,
}: {
  entries: Array<{ entry: RecentEntry; index: number }>;
  onDelete: (index: number) => void;
  onEdit?: (index: number) => void;
}) {
  return (
    <div className="max-h-[60vh] divide-y divide-stone-200 overflow-auto">
      {entries.map(({ entry, index }) => (
        <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0" key={`${entry.item}-${index}`}>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{entry.item}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {entry.meta}
              {entry.account ? ` · ${entry.account}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <p className={`text-sm font-black ${entry.amount > 0 ? "text-emerald-700" : "text-slate-950"}`}>
              {entry.amount > 0 ? "+" : ""}
              {formatEntryAmount(entry)}
            </p>
            {onEdit && (entry.kind === "expense" || entry.amount < 0) ? (
              <button
                className="rounded-md border-2 border-slate-950 bg-[#00c2ff] px-2 py-1 text-xs font-black text-slate-950 hover:bg-[#69dbff]"
                onClick={() => onEdit(index)}
                type="button"
              >
                修改
              </button>
            ) : null}
            <button
              className="rounded-md border-2 border-slate-950 bg-white px-2 py-1 text-xs font-black text-slate-950 hover:bg-[#fff45f]"
              onClick={() => onDelete(index)}
              type="button"
            >
              刪除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
