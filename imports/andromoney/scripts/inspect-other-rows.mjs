import fs from "node:fs";
import path from "node:path";

const root = path.resolve("imports/andromoney");
const rawPath = path.join(root, "raw/AndroMoney-export-2026-05-05.csv");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') { inQuotes = true; continue; }
    if (char === ",") { row.push(field); field = ""; continue; }
    if (char === "\r") continue;
    if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += char;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const buffer = fs.readFileSync(rawPath);
const text = new TextDecoder("big5").decode(buffer);
const rows = parseCsv(text);
const headerIndex = rows.findIndex((row) => row[0] === "Id");
const header = rows[headerIndex];
const dataRows = rows.slice(headerIndex + 1).filter((row) => row.length >= header.length && row[0]);
const col = Object.fromEntries(header.map((name, index) => [name, index]));

const otherRows = [];
const categoryCount = new Map();
let bothEmpty = 0;
let onlyAmountZero = 0;

for (const row of dataRows) {
  const category = (row[col["分類"]] ?? "").trim();
  const subCategory = (row[col["子分類"]] ?? "").trim();
  const payment = (row[col["付款(轉出)"]] ?? "").trim();
  const receive = (row[col["收款(轉入)"]] ?? "").trim();
  const amount = Number(row[col["金額"]] ?? 0);

  if (category === "SYSTEM") continue;
  if (category === "轉帳") continue;
  if (payment && !receive) continue;
  if (!payment && receive) continue;
  if (payment && receive) continue;

  // both empty → "other"
  bothEmpty += 1;
  if (amount === 0) onlyAmountZero += 1;
  categoryCount.set(category, (categoryCount.get(category) ?? 0) + 1);
  if (otherRows.length < 20) otherRows.push({ id: row[col["Id"]], category, subCategory, amount, payment, receive, note: row[col["備註"]], date: row[col["日期"]] });
}

console.log(`兩欄都空（"其他"）總數：${bothEmpty}`);
console.log(`其中金額=0：${onlyAmountZero}`);
console.log("");
console.log("依「分類」分布（前 15 名）：");
[...categoryCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([cat, count]) => {
  console.log(`  ${cat || "(空)"} : ${count}`);
});
console.log("");
console.log("前 10 筆原始樣本：");
otherRows.slice(0, 10).forEach((row) => console.log(JSON.stringify(row)));
