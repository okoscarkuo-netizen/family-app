import { initialAccounts as andromoneyInitialAccounts } from "@/lib/family-data";
import { isSharedAccountLabel, normalizeAccountType, normalizeOwner, type AccountKind, type FamilyAccount } from "@/lib/finance/types";

export type { AccountKind, FamilyAccount };

export type AccountRow = {
  id: string;
  name: string;
  type: string;
  owner: string;
  shared?: boolean | null;
  favorite?: boolean | null;
  kind: AccountKind;
  balance: number | string;
  opening_balance?: number | string;
  balance_date?: string | null;
  remark?: string | null;
  currency: string;
  hidden?: boolean | null;
  sort_order?: number | null;
};

const supportedKinds = new Set<AccountKind>(["asset", "liability"]);
const supportedCurrencies = new Set(["TWD", "USD", "JPY"]);

export const initialAccounts: FamilyAccount[] = andromoneyInitialAccounts.map((account) => ({
  ...account,
  balance: 0,
  openingBalance: 0,
}));

function cleanText(value: unknown, fallback: string, maxLength = 80) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
}

function cleanBalance(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

function resolveAccountOwner(owner: unknown, name: string) {
  if (name.includes("伶")) return "Livia";
  return normalizeOwner(cleanText(owner, "Oscar", 40));
}

export function normalizeAccount(account: Partial<FamilyAccount>, index = 0): FamilyAccount {
  const name = cleanText(account.name, "未命名帳戶");
  const id = cleanText(account.id, `${Date.now()}-${index}-${name}`, 140);
  const kind = supportedKinds.has(account.kind as AccountKind) ? (account.kind as AccountKind) : "asset";
  const currency = supportedCurrencies.has(String(account.currency)) ? String(account.currency) : "TWD";
  const remark = String(account.remark ?? "").trim();

  return {
    id,
    name,
    type: normalizeAccountType(cleanText(account.type, "現金", 40)),
    owner: resolveAccountOwner(account.owner, name),
    shared: Boolean(account.shared) || isSharedAccountLabel(account.owner) || isSharedAccountLabel(account.name),
    favorite: Boolean(account.favorite),
    kind,
    balance: cleanBalance(account.balance),
    openingBalance: cleanBalance(account.openingBalance ?? account.balance),
    ...(account.balanceDate ? { balanceDate: account.balanceDate } : {}),
    ...(remark ? { remark } : {}),
    currency,
    hidden: Boolean(account.hidden),
  };
}

export function normalizeAccounts(accounts: unknown): FamilyAccount[] {
  if (!Array.isArray(accounts)) return [];

  return accounts
    .map((account, index) => normalizeAccount(account as Partial<FamilyAccount>, index))
    .filter((account) => account.name);
}

export function accountFromRow(
  row: AccountRow,
  openingBalanceOverride?: number | null,
  favoriteOverride?: boolean | null,
): FamilyAccount {
  const openingBalance =
    Number.isFinite(openingBalanceOverride as number)
      ? Number(openingBalanceOverride)
      : Number(row.opening_balance ?? row.balance);
  const favorite =
    typeof favoriteOverride === "boolean"
      ? favoriteOverride
      : Boolean(row.favorite);

  return normalizeAccount({
    id: row.id,
    name: row.name,
    type: row.type,
    owner: row.owner,
    shared: row.shared ?? false,
    favorite,
    kind: row.kind,
    balance: Number(row.balance),
    openingBalance,
    balanceDate: row.balance_date ?? undefined,
    remark: row.remark ?? undefined,
    currency: row.currency,
    hidden: Boolean(row.hidden),
  });
}

export function accountToRow(
  account: FamilyAccount,
  index: number,
  options?: { includeOpeningBalance?: boolean; includeFavorite?: boolean }
) {
  const normalized = normalizeAccount(account, index);
  const { openingBalance, remark, favorite, ...row } = normalized;
  const includeOpeningBalance = options?.includeOpeningBalance ?? true;
  const includeFavorite = options?.includeFavorite ?? true;

  return {
    ...row,
    ...(includeOpeningBalance
      ? { opening_balance: openingBalance ?? normalized.balance }
      : {}),
    ...(includeFavorite ? { favorite } : {}),
    remark: remark ?? null,
    sort_order: index,
    is_archived: false,
  };
}
