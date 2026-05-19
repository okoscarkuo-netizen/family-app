export type Category = {
  name: string;
  amount: number;
  color: string;
  percent: number;
};

export type TodoItem = {
  title: string;
  owner: string;
  due: string;
  done: boolean;
};

export type BillReminder = {
  name: string;
  amount: number;
  date: string;
  status: string;
};

export type MaintenanceItem = {
  name: string;
  detail: string;
  urgency: string;
  completed: boolean;
};

export type RecentEntry = {
  item: string;
  amount: number;
  meta: string;
  account?: string;
};

export type AccountKind = "asset" | "liability";

export type FamilyAccount = {
  id: string;
  name: string;
  type: string;
  owner: string;
  kind: AccountKind;
  balance: number;
  currency: string;
};

export type StoredDashboard = {
  accounts: FamilyAccount[];
  categories: Category[];
  todos: TodoItem[];
  bills: BillReminder[];
  maintenance: MaintenanceItem[];
  entries: RecentEntry[];
};

export type AccountSyncSource = "cloud" | "seeded" | "local-fallback";

export type AccountSyncState = {
  enabled: boolean;
  source: AccountSyncSource;
  message: string;
};

export const initialCategories: Category[] = [
  { name: "餐飲", amount: 18420, color: "bg-amber-500", percent: 42 },
  { name: "交通", amount: 6320, color: "bg-sky-500", percent: 14 },
  { name: "家庭用品", amount: 9280, color: "bg-teal-500", percent: 21 },
  { name: "育樂", amount: 5120, color: "bg-rose-500", percent: 12 },
  { name: "其他", amount: 4860, color: "bg-stone-500", percent: 11 },
];

export const initialTodos: TodoItem[] = [
  { title: "週末採買：洗衣精、米、牛奶", owner: "Oscar", due: "今天", done: false },
  { title: "確認五月信用卡明細", owner: "Oscar", due: "明天", done: false },
  { title: "整理冰箱與下週菜單", owner: "Livia", due: "週日", done: true },
];

export const initialBills: BillReminder[] = [
  { name: "房貸", amount: 48200, date: "5/15", status: "待扣款" },
  { name: "中華電信", amount: 1399, date: "5/18", status: "未繳" },
  { name: "電費", amount: 2460, date: "5/22", status: "預估" },
];

export const initialMaintenance: MaintenanceItem[] = [
  { name: "汽車保養", detail: "距離下次保養 1,200 km", urgency: "本月", completed: false },
  { name: "冷氣濾網", detail: "主臥、客廳濾網清潔", urgency: "8 天後", completed: false },
  { name: "淨水器濾芯", detail: "已使用 83 天", urgency: "下月", completed: false },
];

export const initialEntries: RecentEntry[] = [
  { item: "全聯採買", amount: -1280, meta: "餐飲 · Livia · 今天", account: "共同信用卡" },
  { item: "停車月租", amount: -3200, meta: "交通 · Oscar · 昨天", account: "薪轉戶" },
  { item: "薪資入帳", amount: 86500, meta: "收入 · Oscar · 5/5", account: "薪轉戶" },
  { item: "瓦斯費", amount: -740, meta: "帳單 · Oscar · 5/3", account: "家庭現金" },
];

export const initialAccounts: FamilyAccount[] = [
  { id: "andro-001-17ewn56", name: "฿-匯豐_融_薪轉", type: "儲蓄卡", owner: "我", kind: "asset", balance: 26630.46, currency: "TWD" },
  { id: "andro-002-dhhhgw", name: "฿-匯豐_融_外幣", type: "儲蓄卡", owner: "我", kind: "asset", balance: 0.01, currency: "USD" },
  { id: "andro-003-1tnz4wv", name: "฿-LINEbank_融_活儲", type: "儲蓄卡", owner: "我", kind: "asset", balance: 245264.3, currency: "TWD" },
  { id: "andro-004-19rzm4a", name: "฿-台灣星展_融_房貸", type: "儲蓄卡", owner: "我", kind: "asset", balance: 230365, currency: "TWD" },
  { id: "andro-005-wss2ph", name: "฿US-HSBC_融_薪轉", type: "儲蓄卡", owner: "我", kind: "asset", balance: 15418.46, currency: "USD" },
  { id: "andro-006-6asxdh", name: "฿US-BOA500_融_Checking", type: "儲蓄卡", owner: "我", kind: "asset", balance: 924.5, currency: "USD" },
  { id: "andro-007-1wedmic", name: "฿US-BOA_融_Saving", type: "儲蓄卡", owner: "我", kind: "asset", balance: 500, currency: "USD" },
  { id: "andro-008-ljx5pf", name: "฿US-Chase1.5K_融_Checking", type: "儲蓄卡", owner: "我", kind: "asset", balance: 637.79, currency: "USD" },
  { id: "andro-009-8wj5pw", name: "฿US-Chase_融_Saving", type: "儲蓄卡", owner: "我", kind: "asset", balance: 25, currency: "USD" },
  { id: "andro-010-18c5364", name: "฿US-Wells Frago_融_Checking", type: "儲蓄卡", owner: "我", kind: "asset", balance: 1500, currency: "USD" },
  { id: "andro-011-k9lk0m", name: "฿US-USB_融_Checking", type: "儲蓄卡", owner: "我", kind: "asset", balance: 1500, currency: "USD" },
  { id: "andro-012-12f174y", name: "฿US-BOA500_伶_Checking", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 1209.25, currency: "USD" },
  { id: "andro-013-1mjepus", name: "฿US-CHASE1.5K_伶_Checking", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 7027.46, currency: "USD" },
  { id: "andro-014-gutsnj", name: "฿US-CHASE_伶_Saving", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 50, currency: "USD" },
  { id: "andro-015-9ikcih", name: "฿US-USB_伶_Checking", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 1501, currency: "USD" },
  { id: "andro-016-up94r2", name: "฿-永豐_彥伶_一般", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 659046, currency: "TWD" },
  { id: "andro-017-1imei4o", name: "฿-凱基銀行_彥伶", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 20000, currency: "TWD" },
  { id: "andro-018-18i7flw", name: "฿-Crypto", type: "投資", owner: "共同", kind: "asset", balance: 123209, currency: "TWD" },
  { id: "andro-019-k5zl0h", name: "₵-融-Chase", type: "信用卡", owner: "我", kind: "asset", balance: 3519.65, currency: "USD" },
  { id: "andro-020-a82aal", name: "₵-融-美國運通萬豪", type: "信用卡", owner: "我", kind: "asset", balance: 3242.19, currency: "USD" },
  { id: "andro-021-s7x8pe", name: "₵-融-Discover", type: "信用卡", owner: "我", kind: "asset", balance: 5829.97, currency: "USD" },
  { id: "andro-022-1rjk4t7", name: "₵-翰融-BOA", type: "信用卡", owner: "我", kind: "asset", balance: 1088.48, currency: "USD" },
  { id: "andro-023-1g7qphf", name: "₵-彥伶-boa", type: "信用卡", owner: "老婆", kind: "liability", balance: 416.87, currency: "USD" },
  { id: "andro-024-rfe7t7", name: "₵-彥伶-Chase", type: "信用卡", owner: "老婆", kind: "asset", balance: 1255.56, currency: "USD" },
  { id: "andro-025-1fookrk", name: "₵-彥伶-花旗Costco", type: "信用卡", owner: "老婆", kind: "liability", balance: 1566.02, currency: "USD" },
  { id: "andro-026-1iajtcx", name: "₵-融-星展永續", type: "信用卡", owner: "我", kind: "liability", balance: 35277.61, currency: "TWD" },
  { id: "andro-027-hlwq4b", name: "₵-融-匯豐現金", type: "信用卡", owner: "我", kind: "asset", balance: 89523.56, currency: "TWD" },
  { id: "andro-028-t6ebbj", name: "₵-彥伶-華南SnY", type: "信用卡", owner: "老婆", kind: "asset", balance: 19, currency: "TWD" },
  { id: "andro-029-1g8na5t", name: "₵-彥伶-新光寰宇", type: "信用卡", owner: "老婆", kind: "liability", balance: 42139, currency: "TWD" },
  { id: "andro-030-4fky4o", name: "₵-彥伶-凱基信用卡", type: "信用卡", owner: "老婆", kind: "liability", balance: 15660, currency: "TWD" },
  { id: "andro-031-1myy01p", name: "₵-彥伶-永豐信用卡", type: "信用卡", owner: "老婆", kind: "liability", balance: 60227.31, currency: "TWD" },
  { id: "andro-032-l3beny", name: "₵-彥伶-玉山u bear信用卡", type: "信用卡", owner: "老婆", kind: "liability", balance: 23010, currency: "TWD" },
  { id: "andro-033-ts0dem", name: "₵-彥伶-玉山pi", type: "信用卡", owner: "老婆", kind: "liability", balance: 17, currency: "TWD" },
  { id: "andro-034-1sx18wt", name: "₵-彥伶-富邦數位卡", type: "信用卡", owner: "老婆", kind: "liability", balance: 46324, currency: "TWD" },
  { id: "andro-035-1klrrbx", name: "₵-彥伶-星展信用卡", type: "信用卡", owner: "老婆", kind: "asset", balance: 47369, currency: "TWD" },
  { id: "andro-036-104bvm1", name: "₵-彥伶-國泰好市多信用卡", type: "信用卡", owner: "老婆", kind: "liability", balance: 26930, currency: "TWD" },
  { id: "andro-037-is592c", name: "₵-彥伶-中國中油卡", type: "信用卡", owner: "老婆", kind: "liability", balance: 20, currency: "TWD" },
  { id: "andro-038-ov1n09", name: "401K", type: "投資", owner: "共同", kind: "asset", balance: 30504.27, currency: "USD" },
  { id: "andro-039-xluxz6", name: "CRV", type: "車輛", owner: "共同", kind: "asset", balance: 29800, currency: "USD" },
  { id: "andro-040-1ann5ae", name: "E-Tag儲值金", type: "電子錢包", owner: "共同", kind: "asset", balance: 564, currency: "TWD" },
  { id: "andro-041-dpq7y3", name: "LineBank 信貸105W", type: "負債", owner: "共同", kind: "liability", balance: 947790, currency: "TWD" },
  { id: "andro-042-olxlpc", name: "LineBank 信貸54W", type: "負債", owner: "共同", kind: "liability", balance: 402192, currency: "TWD" },
  { id: "andro-043-1d0gos0", name: "LineBank信貸180W", type: "負債", owner: "共同", kind: "liability", balance: 1351411, currency: "TWD" },
  { id: "andro-044-wp2bhj", name: "LineBank信貸200W", type: "負債", owner: "共同", kind: "liability", balance: 847328, currency: "TWD" },
  { id: "andro-045-a8tg1a", name: "Momo紅利金", type: "電子錢包", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-046-180qc4j", name: "PCHome", type: "電子錢包", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-047-12mqugl", name: "T- IB", type: "投資", owner: "共同", kind: "asset", balance: 52400, currency: "USD" },
  { id: "andro-048-1muen44", name: "T- MooMoo", type: "投資", owner: "共同", kind: "asset", balance: 8775.97, currency: "USD" },
  { id: "andro-049-l6324v", name: "T-EToro", type: "投資", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-050-1oadheu", name: "T-伶-IRA-Schwab", type: "投資", owner: "老婆", kind: "asset", balance: 7000, currency: "USD" },
  { id: "andro-051-1ka5rmm", name: "T-嘉信US (TWD)", type: "投資", owner: "共同", kind: "asset", balance: 8398357.87, currency: "TWD" },
  { id: "andro-052-1b64pun", name: "T-嘉信US (USD)", type: "投資", owner: "共同", kind: "liability", balance: 288744, currency: "USD" },
  { id: "andro-053-vswdx", name: "T-彥伶台新日幣", type: "投資", owner: "老婆", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-054-rt8c08", name: "T-彥伶股票", type: "投資", owner: "老婆", kind: "asset", balance: 37, currency: "TWD" },
  { id: "andro-055-yln7lz", name: "T-第一證券US", type: "投資", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-056-1nrersj", name: "T-紫南宮錢母", type: "投資", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-057-lb113k", name: "T-融- Schwab", type: "投資", owner: "我", kind: "asset", balance: 86792.07, currency: "USD" },
  { id: "andro-058-1aucg91", name: "T-融-IRA-Schwab", type: "投資", owner: "我", kind: "asset", balance: 14500, currency: "USD" },
  { id: "andro-059-1ys5jus", name: "Tesla", type: "車輛", owner: "共同", kind: "asset", balance: 45856.74, currency: "USD" },
  { id: "andro-060-fbbk5b", name: "US現金 (USD)", type: "現金", owner: "共同", kind: "asset", balance: 547.64, currency: "USD" },
  { id: "andro-061-1nlhypq", name: "US現金 (TWD)", type: "現金", owner: "共同", kind: "asset", balance: 33198.37, currency: "TWD" },
  { id: "andro-062-xlez1p", name: "XX", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-063-5ks8hv", name: "中油pay", type: "電子錢包", owner: "共同", kind: "asset", balance: 79, currency: "TWD" },
  { id: "andro-064-156e96p", name: "代刷墊 (TWD)", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 357498.79, currency: "TWD" },
  { id: "andro-065-1jp8rio", name: "代刷墊 (USD)", type: "負債", owner: "共同", kind: "liability", balance: 10611.62, currency: "USD" },
  { id: "andro-066-16r8jwl", name: "全聯儲值金", type: "電子錢包", owner: "共同", kind: "asset", balance: 351, currency: "TWD" },
  { id: "andro-067-1uwvtl0", name: "化妝財庫", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 600, currency: "TWD" },
  { id: "andro-068-16qvmrx", name: "台新", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-069-jooafi", name: "國泰", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-070-s1s2k", name: "國泰數位證券-翰融", type: "投資", owner: "我", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-071-bz70qa", name: "外幣_日幣現金", type: "現金", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-072-107nklb", name: "大苑子", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 268, currency: "TWD" },
  { id: "andro-073-czpmq6", name: "奶奶生活帳戶", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-074-1p739x7", name: "奶奶負債帳戶", type: "負債", owner: "共同", kind: "liability", balance: 0, currency: "TWD" },
  { id: "andro-075-tqy94h", name: "家庭口袋現金 (TWD)", type: "現金", owner: "共同", kind: "asset", balance: 40856, currency: "TWD" },
  { id: "andro-076-153sfb4", name: "家庭口袋現金 (USD)", type: "現金", owner: "共同", kind: "asset", balance: 300, currency: "USD" },
  { id: "andro-077-1mihk6p", name: "富邦人壽房貸", type: "保險", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-078-r00egw", name: "府安家代刷墊", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 46953, currency: "TWD" },
  { id: "andro-079-1hgwuj", name: "彥任代刷墊", type: "負債", owner: "共同", kind: "liability", balance: 380, currency: "TWD" },
  { id: "andro-080-1hqpggc", name: "彥伶Buffer", type: "負債", owner: "老婆", kind: "liability", balance: 175544, currency: "TWD" },
  { id: "andro-081-40pjl9", name: "彥伶一卡通", type: "信用卡", owner: "老婆", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-082-1n597kl", name: "彥伶人民幣帳戶", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-083-1m3tixe", name: "彥伶台新", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-084-14o4whu", name: "彥伶台新日幣", type: "儲蓄卡", owner: "老婆", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-085-n2sgye", name: "彥伶投資", type: "投資", owner: "老婆", kind: "liability", balance: 29155, currency: "TWD" },
  { id: "andro-086-146fq5k", name: "房地產-國安街", type: "房地產", owner: "共同", kind: "asset", balance: 14760000, currency: "TWD" },
  { id: "andro-087-tre8jd", name: "新光禮卷", type: "電子錢包", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-088-tf3acb", name: "星展房貸30年", type: "負債", owner: "共同", kind: "liability", balance: 3982988, currency: "TWD" },
  { id: "andro-089-5u67ma", name: "星展房貸40年", type: "負債", owner: "共同", kind: "liability", balance: 5687311, currency: "TWD" },
  { id: "andro-090-1prw8np", name: "爸爸負債帳戶 (TWD)", type: "負債", owner: "共同", kind: "liability", balance: 1440281, currency: "TWD" },
  { id: "andro-091-1syygt8", name: "爸爸負債帳戶 (USD)", type: "負債", owner: "共同", kind: "liability", balance: 18787.85, currency: "USD" },
  { id: "andro-092-5po3tb", name: "玉山", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-093-j896ar", name: "瓦斯桶押金", type: "押金", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-094-1sxa5we", name: "立宏代刷墊 (USD)", type: "儲蓄卡", owner: "共同", kind: "asset", balance: 25.94, currency: "USD" },
  { id: "andro-095-1ttq3bj", name: "紓困借款", type: "負債", owner: "共同", kind: "liability", balance: 0, currency: "TWD" },
  { id: "andro-096-xwmv8k", name: "美國新家", type: "房地產", owner: "共同", kind: "asset", balance: 540000, currency: "USD" },
  { id: "andro-097-1dp5mh6", name: "翰融Buffer (TWD)", type: "儲蓄卡", owner: "我", kind: "asset", balance: 21298.3, currency: "TWD" },
  { id: "andro-098-1d2zcpf", name: "翰融Buffer (USD)", type: "儲蓄卡", owner: "我", kind: "asset", balance: 1177, currency: "USD" },
  { id: "andro-099-p9gxjy", name: "翰融南台圖書館押金", type: "押金", owner: "我", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-100-1hcgjg8", name: "翰融國泰雙囍年年保險", type: "保險", owner: "我", kind: "asset", balance: 706050, currency: "TWD" },
  { id: "andro-101-1qotsmi", name: "翰融投資", type: "投資", owner: "我", kind: "liability", balance: 5000, currency: "TWD" },
  { id: "andro-102-1ybzqk8", name: "翰融股票_台新", type: "投資", owner: "我", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-103-10cynut", name: "車子-Altis", type: "車輛", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-104-sds8pm", name: "遠雄人壽美滿致富２增額終身壽險－０６年期(LJ1)", type: "保險", owner: "共同", kind: "asset", balance: 0, currency: "TWD" },
  { id: "andro-105-1mf3xiz", name: "陳媽負債帳戶", type: "負債", owner: "共同", kind: "liability", balance: 1600000, currency: "TWD" },
];

export const initialDashboard: StoredDashboard = {
  accounts: initialAccounts,
  categories: initialCategories,
  todos: initialTodos,
  bills: initialBills,
  maintenance: initialMaintenance,
  entries: initialEntries,
};

export function normalizeAccount(account: FamilyAccount): FamilyAccount {
  return {
    id: String(account.id || `account-${Date.now()}`),
    name: String(account.name || "未命名帳戶"),
    type: String(account.type || "現金"),
    owner: String(account.owner || "Oscar"),
    kind: account.kind === "liability" ? "liability" : "asset",
    balance: Number(account.balance) || 0,
    currency: String(account.currency || "TWD"),
  };
}

export function normalizeAccounts(accounts: FamilyAccount[]) {
  return accounts.map(normalizeAccount);
}
