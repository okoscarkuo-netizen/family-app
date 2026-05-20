export const accountGroups = [
  "銀行與活儲",
  "現金與儲值",
  "信用卡",
  "房貸與負債",
  "投資",
  "實物資產與保險",
  "代刷墊與暫付款",
] as const;

export type AccountGroup = (typeof accountGroups)[number];

export const accountGroupOrder: AccountGroup[] = [...accountGroups];

export type AccountNormalSide = "asset" | "liability" | "equity";
export type AccountKind = Extract<AccountNormalSide, "asset" | "liability">;
export type AccountOwner = "Oscar" | "Livia" | "外部";
export type TransactionKind = "income" | "expense" | "transfer" | "adjustment" | "refund" | "debt_payment";

export const accountTypes = [
  "現金",
  "儲蓄卡",
  "信用卡",
  "電子錢包",
  "投資",
  "房地產",
  "車輛",
  "保險",
  "押金",
  "負債",
  "債權",
] as const;

export type AccountType = (typeof accountTypes)[number];

export const accountOwners: AccountOwner[] = ["Oscar", "Livia"];
export const accountCurrencies = ["TWD", "USD", "JPY", "CNY"] as const;

export function normalizeOwner(value: unknown, fallback: AccountOwner = "Oscar"): AccountOwner | string {
  const owner = String(value ?? "").trim();

  if (!owner) return fallback;
  if (owner === "Oscar" || owner === "我" || owner === "共同" || owner === "共用") return "Oscar";
  if (owner === "Livia" || owner === "老婆") return "Livia";
  if (owner === "外部") return "外部";
  return owner;
}

export function isSharedAccountLabel(value: unknown) {
  const label = String(value ?? "").trim();
  return label === "共同" || label === "共用";
}

export function isSharedAccount(account: Pick<FamilyAccount, "shared" | "owner" | "name">) {
  return Boolean(account.shared) || isSharedAccountLabel(account.owner) || isSharedAccountLabel(account.name);
}

export type FamilyAccount = {
  id: string;
  name: string;
  type: AccountType | string;
  owner: AccountOwner | string;
  shared?: boolean;
  kind: AccountKind;
  balance: number;
  currency: string;
  group?: AccountGroup;
  normalSide?: AccountNormalSide;
  sourceApp?: "andromoney" | "suishouji" | "manual";
  sourceAccountName?: string;
  needsReview?: boolean;
  hidden?: boolean;
};

const accountTypeGroupMap: Partial<Record<AccountType, AccountGroup>> = {
  現金: "現金與儲值",
  儲蓄卡: "銀行與活儲",
  信用卡: "信用卡",
  電子錢包: "現金與儲值",
  投資: "投資",
  房地產: "實物資產與保險",
  車輛: "實物資產與保險",
  保險: "實物資產與保險",
  押金: "實物資產與保險",
  負債: "房貸與負債",
  債權: "代刷墊與暫付款",
};

const accountNameGroupRules: Array<{ group: AccountGroup; patterns: RegExp[] }> = [
  { group: "信用卡", patterns: [/^₵-/, /信用卡|美國運通|Discover|Costco|u bear/i] },
  { group: "代刷墊與暫付款", patterns: [/代刷墊|Buffer/i] },
  { group: "房貸與負債", patterns: [/房貸|信貸|借款|負債/] },
  { group: "投資", patterns: [/^T-|股票|證券|IRA|Schwab|MooMoo|Crypto|401K|IB/i] },
  { group: "實物資產與保險", patterns: [/房地產|保險|車子|車輛|押金|美國新家|Tesla|CRV/i] },
  { group: "現金與儲值", patterns: [/現金|儲值|pay|E-Tag|口袋|禮卷|禮券|財庫/i] },
];

export function getAccountGroup(account: Pick<FamilyAccount, "group" | "name" | "type">): AccountGroup {
  if (account.group) return account.group;

  const mappedType = accountTypeGroupMap[account.type as AccountType];
  if (mappedType) return mappedType;

  const matchedRule = accountNameGroupRules.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(account.name))
  );

  return matchedRule?.group ?? "銀行與活儲";
}

export function parseAccountKind(value: FormDataEntryValue | string | null): AccountKind {
  return value === "liability" || value === "負債" ? "liability" : "asset";
}

export function accountSideLabel(side: AccountNormalSide): string {
  if (side === "liability") return "負債";
  if (side === "equity") return "淨值";
  return "資產";
}

export function isExpenseLiabilityAccount(account: Pick<FamilyAccount, "kind" | "name" | "type" | "group">) {
  return account.kind === "liability" || getAccountGroup(account) === "信用卡" || account.type === "信用卡";
}

export function normalizeFinancialAccount(account: FamilyAccount): FamilyAccount {
  const kind = parseAccountKind(account.kind);
  const normalSide = account.normalSide ?? kind;

  return {
    ...account,
    kind,
    normalSide,
    group: getAccountGroup(account),
    currency: account.currency || "TWD",
    hidden: account.hidden ?? false,
    shared: account.shared ?? (isSharedAccountLabel(account.owner) || isSharedAccountLabel(account.name)),
  };
}
