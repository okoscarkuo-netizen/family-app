import type { TwdRateSnapshot, TwdRateTable } from '@/lib/exchange-rates'

type Props = {
  rateTable: TwdRateTable
}

const rateCurrencies = ['USD', 'JPY'] as const

function formatRate(value: number, currency: string) {
  const digits = currency === 'JPY' ? 4 : 2
  return new Intl.NumberFormat('zh-TW', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)
}

function formatRateDate(dateKey: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateKey ?? ''))
  if (!match) return '尚未取得'

  return `${match[1]}/${match[2]}/${match[3]}`
}

function formatCheckedAt(isoDate: string) {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return '尚未取得'

  const formatted = new Intl.DateTimeFormat('zh-TW', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Taipei',
  }).format(date)

  return `${formatted} 台北`
}

function sourceLabel(snapshot: TwdRateSnapshot) {
  return snapshot.source === 'cbc' ? '中央銀行每日匯率' : '即時匯率 API'
}

function sourceBadge(snapshot: TwdRateSnapshot) {
  return snapshot.source === 'cbc' ? '央行' : '即時'
}

export function ExchangeRateCard({ rateTable }: Props) {
  const snapshot = rateTable.latest
  const usdRate = snapshot.rates.USD
  const availableRates = rateCurrencies.filter((currency) => Number.isFinite(snapshot.rates[currency]))

  return (
    <section className="rounded-[1.35rem] border border-[#ece4d8] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.72rem] font-black tracking-[0.16em] text-slate-400">匯率狀態</p>
          <p className="mt-1 text-[0.72rem] font-bold text-slate-500">{sourceLabel(snapshot)}</p>
        </div>
        <span className="rounded-full border border-[#d8efe7] bg-[#f3fbf8] px-2.5 py-1 text-[0.68rem] font-black text-[#178369]">
          {sourceBadge(snapshot)}
        </span>
      </div>

      <div className="mt-4 border-b border-[#f1eee9] pb-4">
        <p className="text-[0.68rem] font-bold text-slate-400">USD/TWD</p>
        <p className="mt-1 text-[2.35rem] font-semibold leading-none tracking-normal text-slate-950">
          {Number.isFinite(usdRate) ? `NT$${formatRate(usdRate, 'USD')}` : '暫無資料'}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[0.68rem] font-bold text-slate-400">匯率日期</p>
          <p className="mt-1 text-[0.9rem] font-black text-slate-700">{formatRateDate(snapshot.sourceDate)}</p>
        </div>
        <div>
          <p className="text-[0.68rem] font-bold text-slate-400">系統更新</p>
          <p className="mt-1 text-[0.9rem] font-black text-slate-700">{formatCheckedAt(rateTable.checkedAt)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#f1eee9] pt-3">
        {availableRates.map((currency) => (
          <div key={currency}>
            <p className="text-[0.62rem] font-black text-slate-400">1 {currency}</p>
            <p className="mt-1 text-[0.78rem] font-black text-slate-700">NT${formatRate(snapshot.rates[currency], currency)}</p>
          </div>
        ))}
      </div>

      {rateTable.officialLatestDate && (
        <p className="mt-3 text-[0.62rem] font-bold text-slate-300">
          央行最新 {formatRateDate(rateTable.officialLatestDate)} · 用於外幣帳戶換算
        </p>
      )}
    </section>
  )
}
