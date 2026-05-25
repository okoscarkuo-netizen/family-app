import fs from "node:fs";
import path from "node:path";

const root = path.resolve("imports/andromoney");
const generatedDir = path.join(root, "generated");

const completePath = path.join(generatedDir, "andromoney-accounts-complete-import.csv");
const transactionPath = path.join(generatedDir, "andromoney-accounts-from-transactions.csv");
const screenshotPath = path.join(generatedDir, "screenshot-missing-accounts.csv");
const auditPath = path.join(generatedDir, "account-master-audit.csv");
const readyImportPath = path.join(generatedDir, "account-import-ready.csv");
const reviewNeededPath = path.join(generatedDir, "account-review-needed.csv");
const highPriorityPath = path.join(generatedDir, "account-review-high-priority.csv");
const reconciliationV1Path = path.join(generatedDir, "account-reconciliation-v1-candidates.csv");
const summaryPath = path.join(generatedDir, "account-master-summary.md");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

function readAccountCsv(filePath) {
  const rows = parseCsv(fs.readFileSync(filePath, "utf8").trim());
  const headers = rows[0];
  return rows.slice(1).map((row) =>
    Object.fromEntries(
      headers.map((header, index) => {
        const value = row[index] ?? "";
        return [header, header === "balance" ? Number(value || 0) : value];
      })
    )
  );
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(filePath, headers, rows) {
  const body = [headers.join(",")]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")))
    .join("\n");
  fs.writeFileSync(filePath, `${body}\n`);
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = row[key] || "未分類";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function money(value, currency) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(Number(value || 0))} ${currency}`;
}

function sourceLabel(name, transactionNames, screenshotNames) {
  const fromTransactions = transactionNames.has(name);
  const fromScreenshots = screenshotNames.has(name);

  if (fromTransactions && fromScreenshots) return "交易匯出+截圖";
  if (fromTransactions) return "交易匯出";
  if (fromScreenshots) return "截圖補齊";
  return "未知";
}

function suggestedGroup(account) {
  const name = account.name;

  if (account.type === "負債" || /房貸|信貸|借款|負債/.test(name)) return "貸款與負債";
  if (account.type === "信用卡" || name.startsWith("₵-")) return /一卡通/.test(name) ? "電子票證" : "信用卡";
  if (/代刷墊|Buffer|府安家|化妝財庫|大苑子|立宏/.test(name)) return "代墊與暫付款";
  if (account.type === "儲蓄卡") return "銀行與活儲";
  if (account.type === "現金") return "現金";
  if (account.type === "電子錢包") return "電子錢包";
  if (account.type === "投資") return "投資";
  if (account.type === "房地產") return "房地產";
  if (account.type === "車輛") return "車輛";
  if (account.type === "保險") return "保險";
  if (account.type === "押金") return "押金";
  return "待確認";
}

function reconciliationScope(account, group) {
  if (["銀行與活儲", "信用卡", "現金", "電子錢包", "電子票證"].includes(group)) return "第一版對帳中心";
  if (["代墊與暫付款", "貸款與負債"].includes(group)) return "第二版對帳/人工確認";
  return "資產追蹤，暫不做銀行對帳";
}

function review(account, source, group) {
  const reasons = [];
  let priority = "低";

  const name = account.name;
  const isZero = Math.abs(Number(account.balance || 0)) < 0.00001;

  if (/^(XX|台新|國泰|玉山)$/.test(name) && isZero) {
    reasons.push("名稱像舊帳戶或占位帳戶，且餘額為 0");
    priority = "高";
  }

  if (/Wells Frago/.test(name)) {
    reasons.push("帳戶名稱可能有拼字錯誤：Wells Frago 應確認是否為 Wells Fargo");
    priority = priority === "高" ? priority : "中";
  }

  if (/日幣|人民幣/.test(name) && account.currency === "TWD") {
    reasons.push("名稱看似外幣帳戶，但幣別標示為 TWD");
    priority = priority === "高" ? priority : "中";
  }

  if (account.type === "信用卡" && account.kind === "asset" && !/一卡通/.test(name)) {
    reasons.push("信用卡目前標示為資產，需確認是否代表溢繳/正餘額");
    priority = priority === "高" ? priority : "中";
  }

  if (account.kind === "liability" && !["負債", "信用卡"].includes(account.type)) {
    reasons.push("帳戶類型與資產/負債方向不一致");
    priority = priority === "高" ? priority : "中";
  }

  if (account.type === "儲蓄卡" && group === "代墊與暫付款") {
    reasons.push("原類型是儲蓄卡，但名稱更像代墊/暫付款");
    priority = priority === "高" ? priority : "中";
  }

  if (source === "截圖補齊") {
    reasons.push("此帳戶來自截圖補齊，未在交易匯出付款/收款欄位中出現");
    priority = priority === "高" || priority === "中" ? priority : "低";
  }

  if (isZero && source === "截圖補齊") {
    reasons.push("餘額為 0，需確認是否仍要保留");
  }

  if (account.type === "信用卡" && /一卡通/.test(name)) {
    reasons.push("名稱像電子票證，建議確認是否要歸到電子錢包/儲值類");
    priority = priority === "高" ? priority : "中";
  }

  return {
    priority: reasons.length ? priority : "可匯入",
    status: reasons.length ? "需要確認" : "可直接匯入",
    reasons: reasons.join("；"),
  };
}

function suggestedAction(status, group) {
  if (status === "可直接匯入") return "可先匯入主帳戶清單";
  if (group === "代墊與暫付款") return "建議改類型為代墊/暫付款後再匯入";
  if (group === "電子票證") return "建議改類型為電子錢包或電子票證";
  if (group === "信用卡") return "確認資產/負債方向與餘額後匯入";
  return "人工確認名稱、類型、幣別與是否保留";
}

const completeAccounts = readAccountCsv(completePath);
const transactionNames = new Set(readAccountCsv(transactionPath).map((account) => account.name));
const screenshotNames = new Set(readAccountCsv(screenshotPath).map((account) => account.name));

const auditedAccounts = completeAccounts.map((account) => {
  const group = suggestedGroup(account);
  const source = sourceLabel(account.name, transactionNames, screenshotNames);
  const check = review(account, source, group);

  return {
    account_name: account.name,
    current_type: account.type,
    suggested_group: group,
    owner: account.owner,
    kind: account.kind,
    balance: account.balance.toFixed(2),
    currency: account.currency,
    source,
    reconciliation_scope: reconciliationScope(account, group),
    import_status: check.status,
    review_priority: check.priority,
    review_reason: check.reasons,
    suggested_action: suggestedAction(check.status, group),
  };
});

const headers = [
  "account_name",
  "current_type",
  "suggested_group",
  "owner",
  "kind",
  "balance",
  "currency",
  "source",
  "reconciliation_scope",
  "import_status",
  "review_priority",
  "review_reason",
  "suggested_action",
];

writeCsv(auditPath, headers, auditedAccounts);

writeCsv(
  readyImportPath,
  ["name", "type", "owner", "kind", "balance", "currency"],
  auditedAccounts
    .filter((account) => account.import_status === "可直接匯入")
    .map((account) => ({
      name: account.account_name,
      type: account.current_type,
      owner: account.owner,
      kind: account.kind,
      balance: account.balance,
      currency: account.currency,
    }))
);

writeCsv(
  reviewNeededPath,
  headers,
  auditedAccounts.filter((account) => account.import_status === "需要確認")
);

writeCsv(
  highPriorityPath,
  headers,
  auditedAccounts.filter((account) => account.review_priority === "高")
);

writeCsv(
  reconciliationV1Path,
  headers,
  auditedAccounts.filter((account) => account.reconciliation_scope === "第一版對帳中心")
);

const countsByType = countBy(auditedAccounts, "current_type");
const countsBySource = countBy(auditedAccounts, "source");
const countsByStatus = countBy(auditedAccounts, "import_status");
const countsByPriority = countBy(auditedAccounts, "review_priority");
const countsByScope = countBy(auditedAccounts, "reconciliation_scope");
const highPriority = auditedAccounts.filter((account) => account.review_priority === "高");
const mediumPriority = auditedAccounts.filter((account) => account.review_priority === "中");

const summary = `# AndroMoney 帳戶主清單檢查摘要

產出時間：${new Date().toISOString()}

## 整體狀態

- 帳戶總數：${auditedAccounts.length}
- 可直接匯入：${countsByStatus["可直接匯入"] ?? 0}
- 需要確認：${countsByStatus["需要確認"] ?? 0}
- 高優先確認：${countsByPriority["高"] ?? 0}
- 中優先確認：${countsByPriority["中"] ?? 0}
- 低優先確認：${countsByPriority["低"] ?? 0}

## 來源分布

${Object.entries(countsBySource)
  .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
  .map(([source, count]) => `- ${source}：${count}`)
  .join("\n")}

## 類型分布

${Object.entries(countsByType)
  .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
  .map(([type, count]) => `- ${type}：${count}`)
  .join("\n")}

## 對帳中心分階段

${Object.entries(countsByScope)
  .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
  .map(([scope, count]) => `- ${scope}：${count}`)
  .join("\n")}

## 高優先確認

${highPriority.length
  ? highPriority
      .map(
        (account) =>
          `- ${account.account_name}｜${account.current_type}｜${account.owner}｜${money(account.balance, account.currency)}｜${account.review_reason}`
      )
      .join("\n")
  : "- 無"}

## 中優先確認

${mediumPriority
  .slice(0, 40)
  .map(
    (account) =>
      `- ${account.account_name}｜${account.current_type}｜${account.owner}｜${money(account.balance, account.currency)}｜${account.review_reason}`
  )
  .join("\n")}

${mediumPriority.length > 40 ? `\n另有 ${mediumPriority.length - 40} 筆中優先項目，請看 account-master-audit.csv。` : ""}

## 下一步建議

1. 先確認高優先帳戶是否保留或改名，檔案：account-review-high-priority.csv。
2. 再確認信用卡中標示為 asset 的帳戶是否真的是正餘額。
3. 把代刷墊、Buffer、暫付款從儲蓄卡類型拆出，避免之後銀行對帳混在一起。
4. 第一版對帳中心先接「銀行與活儲、信用卡、現金、電子錢包/電子票證」，檔案：account-reconciliation-v1-candidates.csv。
5. 若要先匯入最保守版本，可用 account-import-ready.csv。
`;

fs.writeFileSync(summaryPath, summary);

console.log(
  JSON.stringify(
    {
      auditPath,
      readyImportPath,
      reviewNeededPath,
      highPriorityPath,
      reconciliationV1Path,
      summaryPath,
      total: auditedAccounts.length,
      countsByStatus,
      countsByPriority,
    },
    null,
    2
  )
);
