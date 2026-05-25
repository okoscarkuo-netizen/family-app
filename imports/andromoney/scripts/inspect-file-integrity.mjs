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

console.log("=== 檔案基本資訊 ===");
console.log(`大小：${buffer.length} bytes`);
console.log(`前 20 bytes：${[...buffer.slice(0, 20)].map((b) => b.toString(16).padStart(2, "0")).join(" ")}`);

// 嘗試 big5 與 big5-hkscs 解碼比對
const big5 = new TextDecoder("big5").decode(buffer);
console.log(`big5 解碼後字元數：${big5.length}`);

const lineCount = big5.split("\n").length;
console.log(`big5 解碼後行數：${lineCount}`);

const rows = parseCsv(big5);
console.log(`CSV 解析後列數：${rows.length}`);

const headerIndex = rows.findIndex((r) => r[0] === "Id");
const header = rows[headerIndex];
console.log(`表頭欄位數：${header.length}`);
console.log(`表頭內容：${JSON.stringify(header)}`);

const dataRows = rows.slice(headerIndex + 1).filter((r) => r[0]);
console.log(`資料列數（去掉空白與表頭）：${dataRows.length}`);

console.log("\n=== 欄位數分布 ===");
const fieldCountDist = new Map();
for (const row of dataRows) {
  fieldCountDist.set(row.length, (fieldCountDist.get(row.length) ?? 0) + 1);
}
[...fieldCountDist.entries()].sort((a, b) => b[1] - a[1]).forEach(([cnt, num]) => {
  console.log(`  欄位數=${cnt}: ${num} 列${cnt === header.length ? "（正常）" : "（異常！）"}`);
});

const col = Object.fromEntries(header.map((name, index) => [name, index]));
const payCol = col["付款(轉出)"];
const recCol = col["收款(轉入)"];
console.log(`\n付款欄位 index: ${payCol}, 收款欄位 index: ${recCol}`);

console.log("\n=== 抽 5 筆「兩欄都空」原始 row 印出來確認 ===");
let count = 0;
for (const row of dataRows) {
  const cat = (row[col["分類"]] ?? "").trim();
  const pay = (row[payCol] ?? "").trim();
  const rec = (row[recCol] ?? "").trim();
  if (cat === "SYSTEM" || cat === "轉帳") continue;
  if (!pay && !rec && cat) {
    console.log(`\nrow.length=${row.length}`);
    console.log(`row 全部欄位:`);
    row.forEach((v, i) => console.log(`  [${i}] ${header[i] ?? "?"} = ${JSON.stringify(v)}`));
    count += 1;
    if (count >= 5) break;
  }
}

console.log("\n=== 檢查：原始 byte 看付款欄位是不是真的空白 ===");
// 找一筆「兩欄都空」row 的 Id，從原始 buffer 抓出該行 bytes
const sample = dataRows.find((row) => {
  const cat = (row[col["分類"]] ?? "").trim();
  const pay = (row[payCol] ?? "").trim();
  const rec = (row[recCol] ?? "").trim();
  return cat !== "SYSTEM" && cat !== "轉帳" && !pay && !rec && cat;
});
if (sample) {
  const sampleId = sample[0];
  const lines = big5.split(/\r?\n/);
  const lineIdx = lines.findIndex((line) => line.startsWith(sampleId + ","));
  if (lineIdx >= 0) {
    const line = lines[lineIdx];
    console.log(`找到 Id=${sampleId} 的原始行（big5 解碼後）：`);
    console.log(line);
    console.log(`此行用逗號 split 後：${JSON.stringify(line.split(","))}`);

    // 算這行在 buffer 中的 byte 位置
    let bytePos = 0;
    let charSeen = 0;
    let targetByteStart = -1;
    for (const target of big5.slice(0, big5.split(/\r?\n/).slice(0, lineIdx).join("\n").length + 1)) {
      // 這個演算法不準，我用更簡單的：直接在 buffer 找 ASCII "{id},"
      break;
    }
    const asciiId = Buffer.from(`\n${sampleId},`, "ascii");
    const idx = buffer.indexOf(asciiId);
    if (idx >= 0) {
      const endIdx = buffer.indexOf(0x0a, idx + asciiId.length);
      const slice = buffer.slice(idx + 1, endIdx >= 0 ? endIdx : idx + asciiId.length + 200);
      console.log(`\n原始 bytes (hex)：`);
      console.log([...slice].map((b) => b.toString(16).padStart(2, "0")).join(" "));
      console.log(`\n原始 bytes (big5 decode)：${new TextDecoder("big5").decode(slice)}`);
    }
  }
}
