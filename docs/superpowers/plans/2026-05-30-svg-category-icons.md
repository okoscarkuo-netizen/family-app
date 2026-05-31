# SVG 分類圖示導入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 162 個自訂 SVG 插圖取代 Iconify twemoji，成為分類圖示系統的圖示來源。

**Architecture:** SVG 靜態檔案放 `public/category-icons/`，圖示名稱以 `svg:NNN_名稱` 格式存 DB。`CategoryIcon.tsx` 新增 `svg:` 分支渲染 `<img>`；舊的 `twemoji:xxx` 繼續透過 Iconify 顯示，無需 DB migration。

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS

---

## File Map

| 動作 | 檔案 | 變更內容 |
|---|---|---|
| 新增 | `public/category-icons/*.svg` | 162 個靜態圖示 |
| 修改 | `components/CategoryIcon.tsx` | 新增 `svg:` 渲染分支 |
| 修改 | `lib/category-icons.ts` | 替換 CHOICES 陣列與關鍵字對應 |

`app/categories/_components/CategoryManager.tsx` **不需改動**：它已經使用 `<CategoryIcon>` 元件，更新底層即可。

---

### Task 1: 複製 SVG 到 public/

**Files:**
- Create: `public/category-icons/` (目錄 + 162 個 SVG)

- [ ] **Step 1: 建立目錄並複製檔案**

```bash
mkdir -p /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/public/category-icons
cp "/Users/hankuo/Downloads/expense_icons_162_no_text_clean_no_blur_v4_svg_png_package/individual_svg/"*.svg \
   /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/public/category-icons/
```

- [ ] **Step 2: 確認 162 個檔案都複製成功**

```bash
ls /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/public/category-icons/ | wc -l
```

預期輸出：`162`

- [ ] **Step 3: Commit**

```bash
git add public/category-icons/
git commit -m "feat: 新增 162 個自訂 SVG 分類圖示到 public/"
```

---

### Task 2: 更新 CategoryIcon.tsx — 新增 svg: 渲染分支

**Files:**
- Modify: `components/CategoryIcon.tsx`

- [ ] **Step 1: 將完整檔案內容替換如下**

```tsx
'use client'

import { Icon } from '@iconify/react'

export function CategoryIcon({
  icon,
  size = 24,
  className,
}: {
  icon: string | null | undefined
  size?: number
  className?: string
}) {
  const value = (icon ?? '').trim()
  if (!value) {
    return (
      <span style={{ fontSize: size, lineHeight: 1 }} className={className} aria-hidden>
        ⭐
      </span>
    )
  }
  // Custom SVG from public/category-icons/
  if (value.startsWith('svg:')) {
    const filename = value.slice(4)
    return (
      <img
        src={`/category-icons/${filename}.svg`}
        width={size}
        height={size}
        className={className}
        alt=""
      />
    )
  }
  // Iconify icon names always contain a colon (e.g. "twemoji:red-apple")
  if (value.includes(':')) {
    return <Icon icon={value} width={size} height={size} className={className} />
  }
  // Legacy emoji or plain text
  return (
    <span style={{ fontSize: size, lineHeight: 1 }} className={className} aria-hidden>
      {value}
    </span>
  )
}
```

- [ ] **Step 2: 確認 TypeScript 沒有錯誤**

```bash
cd /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App && npx tsc --noEmit 2>&1 | head -20
```

預期：無任何輸出（0 錯誤）

- [ ] **Step 3: Commit**

```bash
git add components/CategoryIcon.tsx
git commit -m "feat: CategoryIcon 支援 svg: 前綴渲染自訂 SVG"
```

---

### Task 3: 更新 lib/category-icons.ts — 替換圖示清單與關鍵字對應

**Files:**
- Modify: `lib/category-icons.ts`

- [ ] **Step 1: 將完整檔案替換為以下內容**

```ts
import type { FamilyCategory } from '@/lib/family-transactions'

// Custom SVG icons from public/category-icons/. Format: "svg:NNN_名稱"
export const CATEGORY_ICON_CHOICES = [
  // 餐飲
  'svg:001_早餐', 'svg:002_午餐', 'svg:003_晚餐', 'svg:004_宵夜',
  'svg:005_咖啡', 'svg:006_手搖飲', 'svg:007_甜點', 'svg:008_麵包',
  'svg:009_水果', 'svg:010_蔬菜', 'svg:011_零食', 'svg:012_外送',
  'svg:013_便當', 'svg:014_速食', 'svg:015_火鍋', 'svg:016_燒烤',
  'svg:017_聚餐', 'svg:018_早餐店', 'svg:019_麵食', 'svg:020_海鮮',
  'svg:021_肉品', 'svg:022_牛奶', 'svg:023_酒類',
  // 購物
  'svg:024_超市', 'svg:025_便利商店', 'svg:026_買菜', 'svg:027_菜米油鹽',
  'svg:028_廚房用品', 'svg:029_餐具',
  // 居家
  'svg:030_家具', 'svg:031_家電', 'svg:032_居家裝飾', 'svg:033_寢具',
  'svg:034_收納用品', 'svg:035_清潔用品', 'svg:036_衛生紙',
  'svg:037_洗衣', 'svg:038_洗衣精',
  // 水電帳單
  'svg:039_水費', 'svg:040_電費', 'svg:041_瓦斯', 'svg:042_網路費',
  'svg:043_手機費', 'svg:044_房租', 'svg:045_管理費',
  // 居家雜項
  'svg:046_居家修繕', 'svg:047_搬家', 'svg:048_保全', 'svg:049_園藝',
  'svg:050_花卉', 'svg:051_居家雜貨', 'svg:052_生活百貨',
  'svg:053_快遞運費', 'svg:054_社區費',
  // 交通
  'svg:055_地鐵', 'svg:056_公車', 'svg:057_高鐵', 'svg:058_火車',
  'svg:059_計程車', 'svg:060_停車費', 'svg:061_油費', 'svg:062_過路費',
  'svg:063_租車', 'svg:064_機車', 'svg:065_單車', 'svg:066_洗車',
  'svg:067_維修保養', 'svg:068_充電',
  'svg:069_Honda_CR-V', 'svg:070_Tesla_Model_Y',
  'svg:103_通勤卡', 'svg:104_共享單車', 'svg:105_叫車',
  'svg:106_停車月租', 'svg:107_汽車保險', 'svg:108_道路救援',
  // 服飾美容
  'svg:071_服飾', 'svg:072_鞋子', 'svg:073_包包', 'svg:074_飾品',
  'svg:075_配件', 'svg:076_化妝品', 'svg:077_保養品',
  'svg:078_理髮', 'svg:079_美甲', 'svg:080_美髮', 'svg:081_香水',
  // 醫療健康
  'svg:082_醫院', 'svg:083_診所', 'svg:084_牙科', 'svg:085_藥局',
  'svg:086_藥品', 'svg:087_眼鏡', 'svg:088_體檢',
  'svg:089_健身', 'svg:090_瑜伽', 'svg:091_泳池', 'svg:092_按摩',
  // 教育學習
  'svg:093_學費', 'svg:094_書籍', 'svg:095_文具', 'svg:096_線上課程',
  'svg:097_補習', 'svg:098_證照考試', 'svg:099_辦公用品',
  'svg:100_軟體訂閱', 'svg:101_雲端服務', 'svg:102_列印影印',
  // 娛樂
  'svg:109_電影', 'svg:110_串流訂閱', 'svg:111_音樂', 'svg:112_遊戲',
  'svg:113_KTV', 'svg:114_演唱會', 'svg:115_展覽', 'svg:116_書店',
  'svg:117_玩具',
  // 旅遊
  'svg:118_旅遊', 'svg:119_機票', 'svg:120_飯店', 'svg:121_民宿',
  'svg:122_行李', 'svg:123_旅遊景點', 'svg:124_露營',
  'svg:125_溫泉', 'svg:126_國外旅遊',
  // 育兒家庭
  'svg:127_育兒', 'svg:128_奶粉', 'svg:129_尿布', 'svg:130_托育',
  'svg:131_課後才藝', 'svg:132_學校活動', 'svg:133_孝親',
  'svg:134_家庭聚會', 'svg:135_禮物', 'svg:136_生日',
  'svg:137_紅包', 'svg:138_婚禮', 'svg:139_交際應酬', 'svg:140_捐款',
  // 財務金融
  'svg:141_保險', 'svg:142_壽險', 'svg:143_投資', 'svg:144_儲蓄',
  'svg:145_信用卡年費', 'svg:146_手續費', 'svg:147_稅金',
  'svg:148_貸款', 'svg:149_房貸',
  // 寵物
  'svg:150_寵物飼料', 'svg:151_寵物零食', 'svg:152_寵物美容',
  'svg:153_寵物醫療', 'svg:154_寵物用品', 'svg:155_貓砂',
  'svg:156_寵物住宿',
  // 其他
  'svg:157_會費', 'svg:158_閱讀訂閱', 'svg:159_雜誌',
  'svg:160_其他', 'svg:161_緊急支出', 'svg:162_零用金',
] as const

// Keyword → icon mapping. Specific keywords first.
const CATEGORY_KEYWORD_ICONS: Array<[string[], string]> = [
  // 早餐
  [['早餐', '早點', '早飯', 'breakfast'], 'svg:001_早餐'],
  [['早餐店'], 'svg:018_早餐店'],
  // 午晚餐
  [['午餐', '中餐', '午飯', 'lunch'], 'svg:002_午餐'],
  [['晚餐', '晚飯', 'dinner'], 'svg:003_晚餐'],
  [['宵夜'], 'svg:004_宵夜'],
  // 飲料
  [['咖啡', 'coffee'], 'svg:005_咖啡'],
  [['手搖', '奶茶', '飲料', '飲品'], 'svg:006_手搖飲'],
  [['酒', '紅酒', '白酒', '啤酒', '酒類', 'wine', 'beer'], 'svg:023_酒類'],
  // 食物
  [['甜點', '蛋糕', '甜食', '冰淇淋', '冰', '甜品'], 'svg:007_甜點'],
  [['麵包', '吐司', 'bread'], 'svg:008_麵包'],
  [['水果', '蘋果', '香蕉'], 'svg:009_水果'],
  [['蔬菜', '青菜'], 'svg:010_蔬菜'],
  [['零食', '小吃', '糖果', 'snack'], 'svg:011_零食'],
  [['外送', '外賣', 'delivery'], 'svg:012_外送'],
  [['便當', '飯', '盒飯'], 'svg:013_便當'],
  [['速食', '漢堡', 'hamburger', '披薩', 'pizza', '麥當勞', '炸雞'], 'svg:014_速食'],
  [['火鍋', '涮鍋', '麻辣鍋'], 'svg:015_火鍋'],
  [['燒烤', '烤肉', 'BBQ'], 'svg:016_燒烤'],
  [['聚餐', '餐廳', '外出美食', '聚會', '外食'], 'svg:017_聚餐'],
  [['麵食', '麵', '拉麵', '麵條'], 'svg:019_麵食'],
  [['海鮮', '魚', '蝦', '蟹'], 'svg:020_海鮮'],
  [['肉品', '肉', '牛排', '排骨', '豬肉', '牛肉', '雞肉', '切肉'], 'svg:021_肉品'],
  [['牛奶', '奶', '乳品', 'milk'], 'svg:022_牛奶'],
  // 購物
  [['超市', '大賣場', 'supermarket', 'Costco', 'costco'], 'svg:024_超市'],
  [['便利商店', '7-11', '全家', 'FamilyMart'], 'svg:025_便利商店'],
  [['買菜', '市場', '菜市場'], 'svg:026_買菜'],
  [['菜米油鹽', '食材', '食品', '食物', '伙食', '夥食', '飲食'], 'svg:027_菜米油鹽'],
  [['廚房用品', '廚具', '廚房', '烹飪'], 'svg:028_廚房用品'],
  [['餐具', '碗盤', '筷子'], 'svg:029_餐具'],
  // 居家
  [['家具', 'furniture', '沙發', '桌椅'], 'svg:030_家具'],
  [['家電', '電器', '冰箱'], 'svg:031_家電'],
  [['居家裝飾', '裝潢', '裝修', '佈置'], 'svg:032_居家裝飾'],
  [['寢具', '床', '被子', '枕頭', '床墊'], 'svg:033_寢具'],
  [['收納', '收納用品', '整理箱'], 'svg:034_收納用品'],
  [['清潔用品', '清潔', '打掃', '清掃', '消毒'], 'svg:035_清潔用品'],
  [['衛生紙', '紙巾', '面紙'], 'svg:036_衛生紙'],
  [['洗衣', '乾洗', '洗滌'], 'svg:037_洗衣'],
  [['洗衣精', '洗衣粉', '柔軟精'], 'svg:038_洗衣精'],
  // 帳單
  [['水費'], 'svg:039_水費'],
  [['電費'], 'svg:040_電費'],
  [['瓦斯', '煤氣', '燃氣'], 'svg:041_瓦斯'],
  [['網路', '網路費', '網絡', 'wifi', 'internet'], 'svg:042_網路費'],
  [['手機費', '電話費', '電話', '通話費'], 'svg:043_手機費'],
  [['房租', '租金', 'rent'], 'svg:044_房租'],
  [['管理費', 'hoa', 'HOA', '物業費', '物業'], 'svg:045_管理費'],
  // 居家雜項
  [['居家修繕', '修繕', '修理', '維修', 'repair'], 'svg:046_居家修繕'],
  [['搬家', '搬遷'], 'svg:047_搬家'],
  [['保全', '警報器', '監控'], 'svg:048_保全'],
  [['園藝', '植物', '盆栽'], 'svg:049_園藝'],
  [['花卉', '花', '鮮花', '插花'], 'svg:050_花卉'],
  [['居家雜貨', '雜貨', '五金'], 'svg:051_居家雜貨'],
  [['生活百貨', '生活用品', '日用品', '百貨'], 'svg:052_生活百貨'],
  [['快遞', '運費', '郵費', '包裹', '宅配'], 'svg:053_快遞運費'],
  [['社區費', '社區'], 'svg:054_社區費'],
  // 交通（品牌最先匹配）
  [['Honda', 'CR-V', 'CRV'], 'svg:069_Honda_CR-V'],
  [['Tesla', 'Model Y', 'tesla'], 'svg:070_Tesla_Model_Y'],
  [['地鐵', '捷運', 'metro', 'subway'], 'svg:055_地鐵'],
  [['公車', '巴士', '客運', 'bus'], 'svg:056_公車'],
  [['高鐵', '台鐵'], 'svg:057_高鐵'],
  [['火車', '鐵路', 'train'], 'svg:058_火車'],
  [['計程車', '打車', '打的', '小黃'], 'svg:059_計程車'],
  [['停車月租', '月租車位'], 'svg:106_停車月租'],
  [['停車費', '停車', '車位', '停車場'], 'svg:060_停車費'],
  [['油費', '加油', '加油站', 'gas', '汽油'], 'svg:061_油費'],
  [['過路費', '通行費', '高速', '收費站', 'toll'], 'svg:062_過路費'],
  [['租車'], 'svg:063_租車'],
  [['機車', '摩托', '重機'], 'svg:064_機車'],
  [['共享單車', 'YouBike', 'youbike'], 'svg:104_共享單車'],
  [['單車', '腳踏車', '自行車', 'bike', 'bicycle'], 'svg:065_單車'],
  [['洗車'], 'svg:066_洗車'],
  [['維修保養', '車保', '車檢', '保修'], 'svg:067_維修保養'],
  [['充電', 'EV充電', '電動車充電'], 'svg:068_充電'],
  [['通勤卡', '悠遊卡', '一卡通'], 'svg:103_通勤卡'],
  [['叫車', 'Uber', 'uber'], 'svg:105_叫車'],
  [['汽車保險', '車險'], 'svg:107_汽車保險'],
  [['道路救援', '拖吊'], 'svg:108_道路救援'],
  [['交通', '汽車', '車子', '行車'], 'svg:069_Honda_CR-V'],
  // 服飾美容
  [['服飾', '衣服', '衣物', '上衣', '衣著', '衣飾', 'shirt'], 'svg:071_服飾'],
  [['鞋子', '鞋', 'shoe'], 'svg:072_鞋子'],
  [['包包', '背包', '皮包', 'bag'], 'svg:073_包包'],
  [['飾品', '珠寶', '首飾', '項鍊', '手環'], 'svg:074_飾品'],
  [['配件', '手錶', '錶', 'watch', '腰帶'], 'svg:075_配件'],
  [['化妝品', '化妝', '美妝', '彩妝', 'makeup'], 'svg:076_化妝品'],
  [['保養品', '護膚', '保養', '乳液', 'skincare'], 'svg:077_保養品'],
  [['理髮', '剪髮', '剪頭髮'], 'svg:078_理髮'],
  [['美甲', '指甲'], 'svg:079_美甲'],
  [['美髮', '美容', '髮型', '染髮', '燙髮'], 'svg:080_美髮'],
  [['香水', '香氛'], 'svg:081_香水'],
  // 醫療健康
  [['醫院', '看診', 'hospital'], 'svg:082_醫院'],
  [['診所', '門診', 'clinic'], 'svg:083_診所'],
  [['牙科', '牙醫', '牙齒', 'dentist'], 'svg:084_牙科'],
  [['藥局', '藥房', '藥妝'], 'svg:085_藥局'],
  [['藥品', '藥', '處方', '保健品', '維他命', '營養品'], 'svg:086_藥品'],
  [['眼鏡', 'glasses', '隱形眼鏡'], 'svg:087_眼鏡'],
  [['體檢', '健康檢查', '健檢'], 'svg:088_體檢'],
  [['健身', 'gym', '健身房'], 'svg:089_健身'],
  [['瑜伽', 'yoga'], 'svg:090_瑜伽'],
  [['泳池', '游泳', 'swim'], 'svg:091_泳池'],
  [['按摩', 'spa', 'SPA'], 'svg:092_按摩'],
  // 教育
  [['學費', '補習費', '教育費', '學校', 'tuition'], 'svg:093_學費'],
  [['書籍', '書', 'book'], 'svg:094_書籍'],
  [['文具'], 'svg:095_文具'],
  [['線上課程', '網課', 'online course'], 'svg:096_線上課程'],
  [['補習', '才藝', '課程', 'class'], 'svg:097_補習'],
  [['證照', '考試', '考照', '報名費'], 'svg:098_證照考試'],
  [['辦公用品', '辦公'], 'svg:099_辦公用品'],
  [['軟體訂閱', '軟體', 'software', 'app'], 'svg:100_軟體訂閱'],
  [['雲端', '雲端服務', 'cloud'], 'svg:101_雲端服務'],
  [['列印', '影印', '印刷'], 'svg:102_列印影印'],
  // 娛樂
  [['電影', 'movie'], 'svg:109_電影'],
  [['串流', '影音', '影視', 'Netflix', 'streaming'], 'svg:110_串流訂閱'],
  [['音樂', 'music', 'Spotify', '演唱會'], 'svg:111_音樂'],
  [['遊戲', '電玩', '手遊', 'game'], 'svg:112_遊戲'],
  [['KTV', 'ktv', '唱歌', 'karaoke'], 'svg:113_KTV'],
  [['展覽', '博物館', '美術館'], 'svg:115_展覽'],
  [['書店', '誠品'], 'svg:116_書店'],
  [['玩具', '童玩', 'toy'], 'svg:117_玩具'],
  [['娛樂', '休閒'], 'svg:109_電影'],
  // 旅遊
  [['旅遊', '旅行', 'travel'], 'svg:118_旅遊'],
  [['機票', '飛機', '航空', 'flight'], 'svg:119_機票'],
  [['飯店', '酒店', 'hotel'], 'svg:120_飯店'],
  [['民宿', 'airbnb', 'Airbnb'], 'svg:121_民宿'],
  [['行李', '行李箱', 'luggage'], 'svg:122_行李'],
  [['景點', '旅遊景點', '主題樂園'], 'svg:123_旅遊景點'],
  [['露營', 'camping'], 'svg:124_露營'],
  [['溫泉', '泡湯'], 'svg:125_溫泉'],
  [['國外', '出國', '海外', '境外'], 'svg:126_國外旅遊'],
  // 育兒家庭
  [['育兒', '寶寶', '嬰兒', '小孩', '兒童', '幼兒', 'baby', 'kid'], 'svg:127_育兒'],
  [['奶粉', '配方奶'], 'svg:128_奶粉'],
  [['尿布', '尿褲'], 'svg:129_尿布'],
  [['托育', '托嬰', '保母', '幼稚園', '幼兒園'], 'svg:130_托育'],
  [['課後才藝', '才藝班'], 'svg:131_課後才藝'],
  [['學校活動', '校外教學', '畢業旅行'], 'svg:132_學校活動'],
  [['孝親', '長輩', '父母', '爸媽', 'parent'], 'svg:133_孝親'],
  [['家庭聚會', '家庭'], 'svg:134_家庭聚會'],
  [['禮物', '送禮', 'gift'], 'svg:135_禮物'],
  [['生日', 'birthday'], 'svg:136_生日'],
  [['紅包', 'red envelope'], 'svg:137_紅包'],
  [['婚禮', '結婚', 'wedding'], 'svg:138_婚禮'],
  [['交際應酬', '應酬', '人情', '社交', '請客'], 'svg:139_交際應酬'],
  [['捐款', '慈善', '愛心', '公益'], 'svg:140_捐款'],
  // 財務金融
  [['保險', 'insurance'], 'svg:141_保險'],
  [['壽險', '人壽', 'life insurance'], 'svg:142_壽險'],
  [['投資', '股票', '基金', '理財'], 'svg:143_投資'],
  [['儲蓄', '存款', '存錢', '定存'], 'svg:144_儲蓄'],
  [['信用卡年費', '信用卡', '卡費', 'credit'], 'svg:145_信用卡年費'],
  [['手續費', '服務費', '匯費', '轉帳費'], 'svg:146_手續費'],
  [['稅金', '稅', '報稅', 'tax'], 'svg:147_稅金'],
  [['貸款', '分期', '借款'], 'svg:148_貸款'],
  [['房貸', 'mortgage'], 'svg:149_房貸'],
  [['薪水', '薪資', '工資', '工作', 'salary'], 'svg:143_投資'],
  [['獎金', '紅利', '收入', 'bonus'], 'svg:144_儲蓄'],
  [['金融', '財務'], 'svg:143_投資'],
  [['銀行', '存款', '儲蓄', 'bank'], 'svg:144_儲蓄'],
  // 寵物
  [['寵物飼料', '飼料', '貓飼料', '狗飼料'], 'svg:150_寵物飼料'],
  [['寵物零食'], 'svg:151_寵物零食'],
  [['寵物美容', '寵物理毛'], 'svg:152_寵物美容'],
  [['寵物醫療', '獸醫', '動物醫院'], 'svg:153_寵物醫療'],
  [['寵物用品', '寵物', 'pet'], 'svg:154_寵物用品'],
  [['貓砂', '貓', 'cat'], 'svg:155_貓砂'],
  [['寵物住宿', '寵物旅館'], 'svg:156_寵物住宿'],
  [['狗', 'dog'], 'svg:150_寵物飼料'],
  // 其他
  [['會費', '會員費', 'membership'], 'svg:157_會費'],
  [['閱讀訂閱', '電子書', '訂閱'], 'svg:158_閱讀訂閱'],
  [['雜誌', 'magazine'], 'svg:159_雜誌'],
  [['緊急', '急用', '緊急支出'], 'svg:161_緊急支出'],
  [['零用金', '零花', '私房錢', '零用'], 'svg:162_零用金'],
  [['其他', 'other'], 'svg:160_其他'],
]

export function normalizeCategoryIcon(value: string) {
  return value.trim()
}

function matchKeywordIcon(name: string): string | null {
  const lowered = name.toLowerCase()
  for (const [keywords, icon] of CATEGORY_KEYWORD_ICONS) {
    if (keywords.some((kw) => lowered.includes(kw.toLowerCase()))) {
      return icon
    }
  }
  return null
}

export function getDefaultCategoryIcon(name: string) {
  const seed = name.trim()
  if (!seed) return 'svg:160_其他'

  const matched = matchKeywordIcon(seed)
  if (matched) return matched

  let hash = 2166136261
  for (const char of seed) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 16777619)
  }

  return CATEGORY_ICON_CHOICES[Math.abs(hash) % CATEGORY_ICON_CHOICES.length]
}

export function getCategoryDisplayIcon(category: Pick<FamilyCategory, 'icon' | 'name'> | null | undefined) {
  const customIcon = category?.icon ? normalizeCategoryIcon(category.icon) : ''
  if (customIcon) return customIcon
  return getDefaultCategoryIcon(category?.name ?? '')
}
```

- [ ] **Step 2: 確認 TypeScript 無誤**

```bash
cd /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App && npx tsc --noEmit 2>&1 | head -20
```

預期：無任何輸出（0 錯誤）

- [ ] **Step 3: Commit**

```bash
git add lib/category-icons.ts
git commit -m "feat: 分類圖示改用 162 個自訂 SVG（svg: 前綴格式）"
```

---

### Task 4: 完整驗證

**Files:** 無新修改

- [ ] **Step 1: 跑完整檢查**

```bash
cd /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App && npm run check
```

預期：lint ✓、tsc ✓、build ✓，無任何 error。

- [ ] **Step 2: 確認 public/ 圖示可存取**

啟動 dev server 並手動測試：
```bash
cd /Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App && npm run dev
```

瀏覽 `http://localhost:3000/category-icons/001_早餐.svg` — 應顯示 SVG 圖片。

- [ ] **Step 3: 手動測試分類管理畫面**

1. 開啟 `http://localhost:3000/categories`
2. 點選任一分類的編輯
3. 確認圖示選擇器顯示 SVG 插圖（非 twemoji 表情符號）
4. 選一個圖示存檔，確認分類卡片顯示正確

- [ ] **Step 4: 確認舊 twemoji 圖示的分類仍正常顯示**

若有分類的 icon 欄位值為 `twemoji:xxx`，確認它還是顯示出圖示（Iconify fallback 仍運作）。

- [ ] **Step 5: 最終 commit（若有未提交的修改）**

```bash
git status
# 確認乾淨後不需要額外 commit
```
