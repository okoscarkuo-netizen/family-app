import fs from "node:fs";
import path from "node:path";

const root = path.resolve("imports/andromoney");
const rawPath = path.join(root, "raw/AndroMoney-export-2026-05-05.csv");
const masterPath = path.join(root, "generated/andromoney-accounts-complete-import.csv");
const generatedDir = path.join(root, "generated");
const usageCsvPath = path.join(generatedDir, "transaction-account-usage.csv");
const reportPath = path.join(generatedDir, "transaction-recon-report.md");

function decodeBig5(buffer) {
  return new TextDecoder("big5").decode(buffer);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\r") continue;
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function parseMasterAccounts() {
  const text = fs.readFileSync(masterPath, "utf8");
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell.trim().length));
  const header = rows.shift();
  const nameIndex = header.indexOf("name");
  return new Set(rows.map((row) => row[nameIndex]).filter(Boolean));
}

function classifyKind(category, paymentAccount, receiveAccount) {
  if (category === "SYSTEM") return "system";
  if (category === "轉帳") return "transfer";
  if (paymentAccount && !receiveAccount) return "expense";
  if (!paymentAccount && receiveAccount) return "income";
  if (paymentAccount && receiveAccount) return "transfer";
  return "other";
}

function formatDate(raw) {
  if (!raw || raw.length < 8) return raw;
  const yyyy = raw.slice(0, 4);
  const mm = raw.slice(4, 6);
  const dd = raw.slice(6, 8);
  return `${yyyy}-${mm}-${dd}`;
}

const buffer = fs.readFileSync(rawPath);
const text = decodeBig5(buffer);
const rows = parseCsv(text);

const headerRowIndex = rows.findIndex((row) => row[0] === "Id");
if (headerRowIndex < 0) {
  console.error("找不到表頭列（第一欄為 Id）");
  process.exit(1);
}
const header = rows[headerRowIndex];
const dataRows = rows.slice(headerRowIndex + 1).filter((row) => row.length >= header.length && row[0]);

const col = Object.fromEntries(header.map((name, index) => [name, index]));

const kindCounts = { expense: 0, income: 0, transfer: 0, system: 0, other: 0 };
const currencyCounts = new Map();
const accountUsage = new Map();
let minDate = null;
let maxDate = null;
let totalAmount = 0;
let zeroAmountRows = 0;

function bumpAccount(name, kind) {
  if (!name) return;
  const entry = accountUsage.get(name) ?? {
    name,
    total: 0,
    expense: 0,
    income: 0,
    transferOut: 0,
    transferIn: 0,
    systemInit: 0,
  };
  entry.total += 1;
  if (kind === "expense") entry.expense += 1;
  else if (kind === "income") entry.income += 1;
  else if (kind === "transfer") {
    // bumped twice (out + in) by caller below for transfer
  } else if (kind === "system") entry.systemInit += 1;
  accountUsage.set(name, entry);
}

for (const row of dataRows) {
  const category = row[col["分類"]] ?? "";
  const subCategory = row[col["子分類"]] ?? "";
  const paymentAccount = row[col["付款(轉出)"]]?.trim() ?? "";
  const receiveAccount = row[col["收款(轉入)"]]?.trim() ?? "";
  const currency = row[col["幣別"]]?.trim() ?? "";
  const rawAmount = row[col["金額"]] ?? "0";
  const amount = Number(rawAmount);
  const dateRaw = row[col["日期"]] ?? "";
  const date = formatDate(dateRaw);

  const kind = classifyKind(category, paymentAccount, receiveAccount);
  if (subCategory === "INIT_AMOUNT") {
    kindCounts.system += 1;
  } else {
    kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
  }

  if (currency) currencyCounts.set(currency, (currencyCounts.get(currency) ?? 0) + 1);
  if (!Number.isNaN(amount)) totalAmount += amount;
  if (Number(amount) === 0) zeroAmountRows += 1;

  if (date >= "2000-01-01") {
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }

  if (kind === "transfer" && paymentAccount && receiveAccount) {
    const out = accountUsage.get(paymentAccount) ?? {
      name: paymentAccount,
      total: 0,
      expense: 0,
      income: 0,
      transferOut: 0,
      transferIn: 0,
      systemInit: 0,
    };
    out.total += 1;
    out.transferOut += 1;
    accountUsage.set(paymentAccount, out);

    const inn = accountUsage.get(receiveAccount) ?? {
      name: receiveAccount,
      total: 0,
      expense: 0,
      income: 0,
      transferOut: 0,
      transferIn: 0,
      systemInit: 0,
    };
    inn.total += 1;
    inn.transferIn += 1;
    accountUsage.set(receiveAccount, inn);
  } else {
    if (kind === "expense") bumpAccount(paymentAccount, "expense");
    else if (kind === "income") bumpAccount(receiveAccount, "income");
    else if (kind === "system") {
      bumpAccount(paymentAccount || receiveAccount, "system");
    } else {
      if (paymentAccount) bumpAccount(paymentAccount, "other");
      if (receiveAccount) bumpAccount(receiveAccount, "other");
    }
  }
}

const masterAccountNames = parseMasterAccounts();
const masterAccountLower = new Map();
for (const name of masterAccountNames) {
  masterAccountLower.set(name.trim().toLowerCase(), name);
}

const usageRows = [...accountUsage.values()].sort((a, b) => b.total - a.total);

const matched = [];
const unmatched = [];
for (const row of usageRows) {
  const exactMatch = masterAccountNames.has(row.name);
  const looseMatch = !exactMatch && masterAccountLower.get(row.name.trim().toLowerCase());
  const mappedTo = exactMatch ? row.name : looseMatch ?? "";
  const entry = { ...row, mappedTo, matchType: exactMatch ? "exact" : looseMatch ? "case-insensitive" : "none" };
  if (entry.matchType === "none") unmatched.push(entry);
  else matched.push(entry);
}

const usageHeader = [
  "andromoney_account",
  "total_rows",
  "expense",
  "income",
  "transfer_out",
  "transfer_in",
  "system_init",
  "match_type",
  "mapped_to_app_account",
];

const csvLines = [usageHeader.join(",")];
for (const entry of [...matched, ...unmatched]) {
  csvLines.push(
    [
      csvEscape(entry.name),
      entry.total,
      entry.expense,
      entry.income,
      entry.transferOut,
      entry.transferIn,
      entry.systemInit,
      entry.matchType,
      csvEscape(entry.mappedTo),
    ].join(",")
  );
}
fs.writeFileSync(usageCsvPath, csvLines.join("\n") + "\n", "utf8");

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const totalRows = dataRows.length;
const reportLines = [
  "# AndroMoney 交易匯入 — 偵察報告（Step 1）",
  "",
  `- 原始檔：\`${path.relative(process.cwd(), rawPath)}\``,
  `- 產生時間：${new Date().toISOString()}`,
  "",
  "## 1. 整體統計",
  "",
  `- 資料列總數（不含表頭）：**${totalRows}**`,
  `- 日期範圍：**${minDate ?? "n/a"} ~ ${maxDate ?? "n/a"}**`,
  `- 金額為 0 的列：${zeroAmountRows}`,
  "",
  "### 1.1 交易類型分布",
  "",
  "| 類型 | 筆數 |",
  "|------|------|",
  `| 支出（expense） | ${kindCounts.expense} |`,
  `| 收入（income） | ${kindCounts.income} |`,
  `| 轉帳（transfer） | ${kindCounts.transfer} |`,
  `| SYSTEM 初始化（會排除） | ${kindCounts.system} |`,
  `| 其他/無法分類 | ${kindCounts.other} |`,
  "",
  `→ 預計實際匯入：**約 ${kindCounts.expense + kindCounts.income + kindCounts.transfer} 筆**（不含 SYSTEM 初始化）`,
  "",
  "### 1.2 幣別分布",
  "",
  "| 幣別 | 筆數 |",
  "|------|------|",
  ...[...currencyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, count]) => `| ${currency || "（空）"} | ${count} |`),
  "",
  "## 2. 帳戶對應狀況",
  "",
  `- AndroMoney 交易裡用到的不重複帳戶數：**${usageRows.length}**`,
  `- 完全對得上你 App 主帳戶清單（${masterAccountNames.size} 個）的：**${matched.filter((e) => e.matchType === "exact").length}**`,
  `- 大小寫差異就能對上的：**${matched.filter((e) => e.matchType === "case-insensitive").length}**`,
  `- 完全對不上需要人工處理的：**${unmatched.length}**`,
  "",
  "### 2.1 對得上的帳戶（前 20 名，按筆數排序）",
  "",
  "| AndroMoney 名稱 | 筆數 | 對應到 App 帳戶 |",
  "|---|---:|---|",
  ...matched
    .slice(0, 20)
    .map((entry) => `| ${entry.name} | ${entry.total} | ${entry.mappedTo}${entry.matchType === "case-insensitive" ? "（大小寫差異）" : ""} |`),
  "",
  "### 2.2 對不上的帳戶（全部列出，按筆數排序）",
  "",
  unmatched.length === 0
    ? "（無，所有帳戶都對得上）"
    : ["| AndroMoney 名稱 | 筆數 | 支出 | 收入 | 轉出 | 轉入 |", "|---|---:|---:|---:|---:|---:|"]
        .concat(
          unmatched.map((entry) =>
            `| ${entry.name} | ${entry.total} | ${entry.expense} | ${entry.income} | ${entry.transferOut} | ${entry.transferIn} |`
          )
        )
        .join("\n"),
  "",
  "## 3. 下一步",
  "",
  "1. 看 2.2「對不上的帳戶」清單，幫每一個決定：對應到 App 哪個帳戶？要忽略？還是新增？",
  "2. 把對應結果填進對照表（Step 2 會建立 `account-mapping.csv`）",
  "3. Step 2 用對照表跑轉換腳本，產出 `RecentEntry[]` JSON",
  "",
  "## 4. 完整明細",
  "",
  `所有 ${usageRows.length} 個帳戶的使用統計輸出在：`,
  "",
  `\`${path.relative(process.cwd(), usageCsvPath)}\``,
  "",
];

fs.writeFileSync(reportPath, reportLines.join("\n"), "utf8");

console.log(`✓ 偵察報告：${path.relative(process.cwd(), reportPath)}`);
console.log(`✓ 帳戶使用明細：${path.relative(process.cwd(), usageCsvPath)}`);
console.log("");
console.log(`資料列：${totalRows}`);
console.log(
  `分類：支出 ${kindCounts.expense}・收入 ${kindCounts.income}・轉帳 ${kindCounts.transfer}・SYSTEM ${kindCounts.system}・其他 ${kindCounts.other}`
);
console.log(`日期：${minDate} ~ ${maxDate}`);
console.log(
  `帳戶：總共 ${usageRows.length} 個 / 對得上 ${matched.filter((e) => e.matchType === "exact").length} / 大小寫差異 ${matched.filter((e) => e.matchType === "case-insensitive").length} / 對不上 ${unmatched.length}`
);
