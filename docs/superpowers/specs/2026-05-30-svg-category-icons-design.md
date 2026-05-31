# SVG 分類圖示導入設計規格

**日期**：2026-05-30  
**分支**：feat/reminders-upgrade  
**狀態**：已核准，待實作

---

## 目標

將 162 個自訂 SVG 插圖圖示導入分類系統，完全取代現有的 Iconify twemoji 圖示。  
維持現有 UI 互動不變（格狀選擇器）。

---

## 圖示來源

- **檔案位置**：`/Users/hankuo/Downloads/expense_icons_162_no_text_clean_no_blur_v4_svg_png_package/individual_svg/`
- **數量**：162 個 SVG 檔案
- **命名格式**：`NNN_中文名稱.svg`，例如 `001_早餐.svg`、`069_Honda_CR-V.svg`

---

## 架構決策

### 1. 儲存方式：`public/category-icons/`

162 個 SVG 複製到 `public/category-icons/`，作為靜態資產由瀏覽器直接存取。

- 零 JS 打包體積
- 瀏覽器可快取
- 不需 build 即可新增圖示

### 2. 識別格式：`svg:NNN_中文名稱`

DB 中的 icon 欄位統一用 `svg:` 前綴，例如：

```
svg:001_早餐
svg:069_Honda_CR-V
```

和現有 `twemoji:hamburger` 格式一致，`CategoryIcon.tsx` 可依前綴分流渲染。

### 3. 向後相容

已存在 DB 的 `twemoji:xxx` 圖示繼續透過 Iconify 正常顯示，無需 DB migration。  
新選擇的分類圖示一律存 `svg:xxx` 格式。

---

## 修改清單

### 步驟 1：複製 SVG 到 `public/`

```
public/category-icons/
├── 001_早餐.svg
├── 002_午餐.svg
├── ...（共 162 個）
└── 162_零用金.svg
```

### 步驟 2：更新 `components/CategoryIcon.tsx`

新增 `svg:` 分支，在現有 Iconify 判斷（含 `:`）之前先處理：

```tsx
if (value.startsWith('svg:')) {
  const filename = value.slice(4) // 去掉 "svg:" 前綴
  return <img src={`/category-icons/${filename}.svg`} width={size} height={size} className={className} alt="" />
}
```

### 步驟 3：更新 `lib/category-icons.ts`

- 將 `CATEGORY_ICON_CHOICES` 陣列改成 162 個 `svg:NNN_名稱` 字串
- 更新 `CATEGORY_KEYWORD_ICONS` 關鍵字對應，改用 `svg:` 格式
- `normalizeCategoryIcon`、`getDefaultCategoryIcon`、`getCategoryDisplayIcon` 函式邏輯不變

### 步驟 4：更新 `app/categories/_components/CategoryManager.tsx`

選擇器格子目前用 `<Icon>` 元件顯示 Iconify 圖示，改成通用的 `<CategoryIcon>` 元件即可（或直接用 `<img>`），保持格狀排列不變。

---

## 關鍵字對應策略

將現有 `CATEGORY_KEYWORD_ICONS` 的中文關鍵字保留，對應目標改成 SVG 版：

| 關鍵字範例 | 舊對應 | 新對應 |
|---|---|---|
| 早餐 | `twemoji:cooking` | `svg:001_早餐` |
| 午餐 | `twemoji:bento-box` | `svg:002_午餐` |
| 咖啡 | `twemoji:hot-beverage` | `svg:005_咖啡` |
| 停車 | `twemoji:p-button` | `svg:060_停車費` |
| ...（依序對應全部 162 個）| | |

---

## 不在本次範圍

- 不修改帳本（ledger）或帳戶（accounts）圖示
- 不新增搜尋功能
- 不修改 DB schema
- 不需要 migration script

---

## 成功標準

1. `CategoryManager` 的圖示選擇器顯示 162 個 SVG 插圖
2. 選擇圖示後，分類卡片正確顯示對應 SVG
3. 舊有 twemoji 圖示的分類繼續正常顯示
4. `npm run check` 通過（lint + tsc + build）
