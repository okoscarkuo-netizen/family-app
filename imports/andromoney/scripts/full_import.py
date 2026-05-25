"""
AndroMoney full import script
清空並重新匯入所有帳戶、分類、商家、交易
"""

import csv
import json
import uuid
import random
import string
import re
import requests
from collections import defaultdict
from datetime import datetime

SUPABASE_URL = "https://ampmemzawmqwcplmclze.supabase.co/rest/v1"
SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcG1lbXphd21xd2NwbG1jbHplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIxODIxOCwiZXhwIjoyMDkzNzk0MjE4fQ.ytpVS6bznspWJUGukIsuONyvhuLOQd5WwfHJruJaDQ0"
CSV_PATH = "/Users/hankuo/Documents/AI_Workspace/1_Projects/Family_App/imports/andromoney/raw/_var_mobile_Containers_Data_Application_AF53372E-B0E9-45E9-8AB6-B9E0865E7DE8_Documents_AndroMoney.csv"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

INCOME_CATEGORIES = {"其他收入", "彥伶收入", "翰融收入", "股票", "銀行收入"}

def short_id():
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=7))

def api_delete(table, filter_param="id=gte.0"):
    # DELETE all rows
    r = requests.delete(
        f"{SUPABASE_URL}/{table}?{filter_param}",
        headers=HEADERS,
    )
    if r.status_code not in (200, 204):
        # try with no filter (delete all)
        r = requests.delete(
            f"{SUPABASE_URL}/{table}?id=not.is.null",
            headers=HEADERS,
        )
    return r.status_code

def api_delete_all(table):
    # Use a wildcard-style delete by matching non-null id
    r = requests.delete(
        f"{SUPABASE_URL}/{table}?id=not.is.null",
        headers=HEADERS,
    )
    return r.status_code, r.text

def api_insert_batch(table, rows, batch_size=500):
    total = len(rows)
    inserted = 0
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        r = requests.post(
            f"{SUPABASE_URL}/{table}",
            headers=HEADERS,
            json=batch,
        )
        if r.status_code not in (200, 201):
            print(f"  ERROR inserting {table} batch {i//batch_size}: {r.status_code} {r.text[:200]}")
            return False
        inserted += len(batch)
        print(f"  {table}: {inserted}/{total} 筆已匯入")
    return True

def parse_date(date_str):
    """10100101 -> 2010-01-01"""
    try:
        return datetime.strptime(str(date_str), "%Y%m%d").strftime("%Y-%m-%d")
    except:
        return None

def load_csv():
    with open(CSV_PATH, encoding='big5') as f:
        reader = csv.reader(f)
        rows = list(reader)
    headers = rows[1]
    data = rows[2:]
    return headers, data

def extract_account_currency(data, headers):
    """每個帳戶的幣別：從交易推導（取最常出現的）"""
    pay_idx = headers.index('付款(轉出)')
    recv_idx = headers.index('收款(轉入)')
    cur_idx = headers.index('幣別')
    cat_idx = headers.index('分類')

    account_currencies = defaultdict(lambda: defaultdict(int))
    for row in data:
        if len(row) <= max(pay_idx, recv_idx, cur_idx): continue
        cat = row[cat_idx].strip()
        if cat == 'SYSTEM': continue
        pay = row[pay_idx].strip()
        recv = row[recv_idx].strip()
        cur = row[cur_idx].strip() or 'TWD'
        if pay: account_currencies[pay][cur] += 1
        if recv: account_currencies[recv][cur] += 1

    return {acc: max(cur_counts, key=cur_counts.get)
            for acc, cur_counts in account_currencies.items()}

def determine_account_kind(name):
    """從帳戶名稱判斷 asset/liability"""
    liability_keywords = ['貸', '負債', '信用卡', '₵', 'loan', 'mortgage', '房貸']
    name_lower = name.lower()
    for kw in liability_keywords:
        if kw in name_lower:
            return 'liability'
    return 'asset'

def determine_account_type(name):
    """從帳戶名稱推斷類型"""
    if name.startswith('₵') or '信用卡' in name:
        return '信用卡'
    if name.startswith('T-') or '股票' in name or '證券' in name or '投資' in name:
        return '投資'
    if '現金' in name:
        return '現金'
    if any(k in name for k in ['貸', '房貸', '負債']):
        return '負債'
    if any(k in name for k in ['人壽', '保險']):
        return '保險'
    if any(k in name for k in ['押金']):
        return '押金'
    if any(k in name for k in ['一卡通', 'E-Tag', '全聯', '中油', '儲值', 'pay', 'PAY']):
        return '電子錢包'
    return '儲蓄卡'

def build_accounts(data, headers):
    account_currencies = extract_account_currency(data, headers)
    accounts = []
    account_name_to_id = {}
    for i, (name, currency) in enumerate(sorted(account_currencies.items()), start=1):
        acc_id = f"andro-{i:03d}-{short_id()}"
        account_name_to_id[name] = acc_id
        accounts.append({
            "id": acc_id,
            "name": name,
            "type": determine_account_type(name),
            "owner": "Oscar",
            "kind": determine_account_kind(name),
            "balance": 0.0,
            "currency": currency,
            "hidden": False,
            "sort_order": i,
            "is_archived": False,
        })
    return accounts, account_name_to_id

def build_categories(data, headers):
    cat_idx = headers.index('分類')
    subcat_idx = headers.index('子分類')
    pay_idx = headers.index('付款(轉出)')
    recv_idx = headers.index('收款(轉入)')

    # Collect unique (cat, subcat) pairs and their kinds
    cat_kinds = defaultdict(set)
    subcat_set = defaultdict(set)  # cat -> set of subcats
    for row in data:
        if len(row) <= max(cat_idx, subcat_idx, pay_idx, recv_idx): continue
        cat = row[cat_idx].strip()
        subcat = row[subcat_idx].strip()
        if cat == 'SYSTEM': continue
        pay = row[pay_idx].strip()
        recv = row[recv_idx].strip()
        if not pay and not recv: continue

        if cat in INCOME_CATEGORIES:
            kind = 'income'
        elif pay and recv:
            kind = 'transfer'
        elif pay:
            kind = 'expense'
        else:
            kind = 'income'

        cat_kinds[cat].add(kind)
        if subcat:
            subcat_set[cat].add(subcat)

    # Determine category kind (use dominant)
    def dominant_kind(kinds):
        if 'expense' in kinds: return 'expense'
        if 'income' in kinds: return 'income'
        return 'transfer'

    categories = []
    cat_name_to_id = {}
    subcat_name_to_id = {}  # (cat, subcat) -> id

    for i, (cat, kinds) in enumerate(sorted(cat_kinds.items()), start=1):
        cat_id = str(uuid.uuid4())
        cat_name_to_id[cat] = cat_id
        categories.append({
            "id": cat_id,
            "name": cat,
            "kind": dominant_kind(kinds),
            "icon": None,
            "color": None,
            "sort_order": i,
            "is_archived": False,
            "source_app": "andromoney",
            "parent_id": None,
        })

        for j, subcat in enumerate(sorted(subcat_set[cat]), start=1):
            sub_id = str(uuid.uuid4())
            subcat_name_to_id[(cat, subcat)] = sub_id
            categories.append({
                "id": sub_id,
                "name": subcat,
                "kind": dominant_kind(kinds),
                "icon": None,
                "color": None,
                "sort_order": j,
                "is_archived": False,
                "source_app": "andromoney",
                "parent_id": cat_id,
            })

    return categories, cat_name_to_id, subcat_name_to_id

def build_merchants(data, headers):
    merchant_idx = headers.index('商家(公司)')
    cat_idx = headers.index('分類')
    pay_idx = headers.index('付款(轉出)')
    recv_idx = headers.index('收款(轉入)')

    merchant_names = set()
    for row in data:
        if len(row) <= merchant_idx: continue
        cat = row[cat_idx].strip() if len(row) > cat_idx else ''
        if cat == 'SYSTEM': continue
        pay = row[pay_idx].strip() if len(row) > pay_idx else ''
        recv = row[recv_idx].strip() if len(row) > recv_idx else ''
        if not pay and not recv: continue
        m = row[merchant_idx].strip()
        if m:
            merchant_names.add(m)

    merchants = []
    merchant_name_to_id = {}
    for name in sorted(merchant_names):
        mid = str(uuid.uuid4())
        merchant_name_to_id[name] = mid
        merchants.append({
            "id": mid,
            "name": name,
            "normalized_name": name.lower().strip(),
        })
    return merchants, merchant_name_to_id

def build_transactions(data, headers, account_name_to_id, cat_name_to_id, subcat_name_to_id, merchant_name_to_id):
    pay_idx = headers.index('付款(轉出)')
    recv_idx = headers.index('收款(轉入)')
    cat_idx = headers.index('分類')
    subcat_idx = headers.index('子分類')
    amt_idx = headers.index('金額')
    cur_idx = headers.index('幣別')
    date_idx = headers.index('日期')
    note_idx = headers.index('備註')
    merchant_idx = headers.index('商家(公司)')

    transactions = []
    skipped = 0

    for row in data:
        if len(row) <= max(pay_idx, recv_idx, cat_idx, amt_idx): continue

        cat = row[cat_idx].strip()
        if cat == 'SYSTEM': continue

        pay = row[pay_idx].strip() if len(row) > pay_idx else ''
        recv = row[recv_idx].strip() if len(row) > recv_idx else ''
        if not pay and not recv:
            skipped += 1
            continue

        # 跳過同帳戶轉帳（資料輸入錯誤）
        if pay and recv and pay == recv:
            skipped += 1
            continue

        try:
            amount = abs(float(row[amt_idx]))
        except:
            amount = 0.0

        currency = row[cur_idx].strip() if len(row) > cur_idx else 'TWD'
        if not currency: currency = 'TWD'

        date_str = parse_date(row[date_idx].strip() if len(row) > date_idx else '')
        if not date_str: continue

        subcat = row[subcat_idx].strip() if len(row) > subcat_idx else ''
        note = row[note_idx].strip() if len(row) > note_idx else ''
        merchant = row[merchant_idx].strip() if len(row) > merchant_idx else ''

        # Determine kind
        if cat in INCOME_CATEGORIES:
            kind = 'income'
        elif pay and recv:
            kind = 'transfer'
        elif pay:
            kind = 'expense'
        else:
            kind = 'income'

        # Resolve IDs
        # expense/transfer: account_id = pay (source); income: account_id = recv (destination)
        if kind == 'income':
            account_id = account_name_to_id.get(recv) if recv else None
            to_account_id = None
        elif kind == 'transfer':
            account_id = account_name_to_id.get(pay) if pay else None
            to_account_id = account_name_to_id.get(recv) if recv else None
        else:  # expense
            account_id = account_name_to_id.get(pay) if pay else None
            to_account_id = None
        category_id = subcat_name_to_id.get((cat, subcat)) or cat_name_to_id.get(cat)
        merchant_id = merchant_name_to_id.get(merchant) if merchant else None

        transactions.append({
            "id": str(uuid.uuid4()),
            "kind": kind,
            "title": subcat or cat,
            "amount": amount,
            "currency": currency,
            "category_id": category_id,
            "account_id": account_id,
            "to_account_id": to_account_id,
            "owner": "Oscar",
            "merchant": merchant or None,
            "merchant_id": merchant_id,
            "occurred_on": date_str,
            "note": note or None,
        })

    print(f"跳過缺帳戶筆數: {skipped}")
    return transactions

def main():
    print("=== 讀取 CSV ===")
    headers, data = load_csv()
    print(f"CSV 總行數: {len(data)}")

    print("\n=== 準備資料 ===")
    accounts, account_name_to_id = build_accounts(data, headers)
    print(f"帳戶: {len(accounts)}")

    categories, cat_name_to_id, subcat_name_to_id = build_categories(data, headers)
    print(f"分類: {len(categories)}")

    merchants, merchant_name_to_id = build_merchants(data, headers)
    print(f"商家: {len(merchants)}")

    transactions = build_transactions(
        data, headers, account_name_to_id, cat_name_to_id, subcat_name_to_id, merchant_name_to_id
    )
    print(f"交易: {len(transactions)}")

    print("\n=== 清空資料庫 ===")
    for table in ['family_ledger_entries', 'family_transactions', 'family_accounts', 'family_categories', 'family_merchants', 'accounts']:
        status, text = api_delete_all(table)
        print(f"  DELETE {table}: {status}")
        if status not in (200, 204):
            print(f"    回應: {text[:200]}")

    print("\n=== 匯入資料 ===")
    ok = api_insert_batch('family_accounts', accounts)
    if not ok:
        print("帳戶匯入失敗，中止")
        return

    ok = api_insert_batch('family_categories', categories)
    if not ok:
        print("分類匯入失敗，中止")
        return

    if merchants:
        ok = api_insert_batch('family_merchants', merchants)
        if not ok:
            print("商家匯入失敗，中止")
            return

    ok = api_insert_batch('family_transactions', transactions)
    if not ok:
        print("交易匯入失敗，中止")
        return

    print("\n=== 完成 ===")
    print(f"帳戶 {len(accounts)} | 分類 {len(categories)} | 商家 {len(merchants)} | 交易 {len(transactions)}")

if __name__ == "__main__":
    main()
