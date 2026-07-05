import { notFound } from 'next/navigation'
import { MaintenanceRecordDetail } from '@/app/reminders/_components/MaintenanceRecordDetail'
import { getMaintenanceRecordById } from '@/lib/reminders-db'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string }>
}

export default async function MaintenanceRecordDetailPage({ params, searchParams }: PageProps) {
  const [{ id }, { from }] = await Promise.all([params, searchParams])
  const record = await getMaintenanceRecordById(decodeURIComponent(id))
  if (!record) notFound()

  return (
    <MaintenanceRecordDetail
      record={record}
      returnUrl={from || `/reminders/${encodeURIComponent(record.reminderId)}`}
    />
  )
}
