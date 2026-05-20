import { initialAccounts as andromoneyInitialAccounts } from "@/lib/family-data";
import { isSharedAccountLabel, normalizeOwner, type AccountKind, type FamilyAccount } from "@/lib/finance/types";

export type { AccountKind, FamilyAccount };

export type AccountRow = {
  id: string;
  name: string;
  type: string;
  owner: string;
  shared?: boolean | null;
  kind: AccountKind;
  balance: number | string;
  currency: string;
  hidden?: boolean | null;
  sort_order?: number | null;
};

const supportedKinds = new Set<AccountKind>(["asset", "liability"]);
const supportedCurrencies = new Set(["TWD", "USD", "JPY", "CNY"]);

export const initialAccounts: FamilyAccount[] = andromoneyInitialAccounts;

function cleanText(value: unknown, fallback: string, maxLength = 80) {
  const text = String(value ?? "").trim();
  return (text || fallback).slice(0, maxLength);
}

function cleanBalance(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100) / 100;
}

export function normalizeAccount(account: Partial<FamilyAccount>, index = 0): FamilyAccount {
  const name = cleanText(account.name, "未命名帳戶");
  const id = cleanText(account.id, `${Date.now()}-${index}-${name}`, 140);
  const kind = supportedKinds.has(account.kind as AccountKind) ? (account.kind as AccountKind) : "asset";
  const currency = supportedCurrencies.has(String(account.currency)) ? String(account.currency) : "TWD";

  return {
    id,
    name,
    type: cleanText(account.type, "現金", 40),
    owner: normalizeOwner(cleanText(account.owner, "Oscar", 40)),
    shared: Boolean(account.shared) || isSharedAccountLabel(account.owner) || isSharedAccountLabel(account.name),
    kind,
    balance: cleanBalance(account.balance),
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

export function accountFromRow(row: AccountRow): FamilyAccount {
  return normalizeAccount({
    id: row.id,
    name: row.name,
    type: row.type,
    owner: row.owner,
    shared: row.shared ?? false,
    kind: row.kind,
    balance: Number(row.balance),
    currency: row.currency,
    hidden: Boolean(row.hidden),
  });
}

export function accountToRow(account: FamilyAccount, index: number) {
  const normalized = normalizeAccount(account, index);

  return {
    ...normalized,
    sort_order: index,
    is_archived: false,
  };
}
