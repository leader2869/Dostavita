import { notFound, redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireSuperadmin } from '@/lib/api/auth'
import { BackButton } from '@/components/ui/BackButton'
import { ORDER_STATUS_LABELS } from '@/lib/constants'
import { ChangePasswordForm } from '@/components/admin/ChangePasswordForm'

export const dynamic = 'force-dynamic'
const money = (value: unknown, currency = 'BYN') => `${Number(value).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
const roles: Record<string, string> = { client: 'Клиент', driver: 'Водитель', customer: 'Организация', fleet: 'Автопарк', admin: 'Администратор', superadmin: 'Суперадмин' }

export default async function UserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const db = await createServerSupabaseClient()
  const auth = await requireSuperadmin(db)
  if (!auth.ok) redirect(auth.response.status === 401 ? '/login' : '/dashboard')
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const profileResult = await db.from('profiles').select('id, email, full_name, phone, role, created_at, organization_id, organization_attached_at, vehicle_type, vehicle_brand, vehicle_model, vehicle_number').eq('id', id).maybeSingle()
  if (profileResult.error) return <p role="alert">Не удалось загрузить пользователя. Обновите страницу.</p>
  const person = profileResult.data
  if (!person) notFound()
  const [balance, transactions, organization] = await Promise.all([
    db.from('balances').select('amount, currency, updated_at').eq('user_id', id).maybeSingle(),
    db.from('transactions').select('id, amount, type, description, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(20),
    person.organization_id ? db.from('profiles').select('id, organization_name, full_name, email, phone').eq('id', person.organization_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const driverOrders = person.role === 'driver' ? await db.from('orders').select('id, order_number, status, final_price, is_paid').eq('executor_user_id', id).order('created_at', { ascending: false }).limit(20) : null
  const debts = await db.from('receivables').select('id, amount, currency, status').eq('debtor_user_id', id).eq('status', 'unpaid').order('created_at', { ascending: false }).limit(20)
  return <div className="space-y-6 text-gray-900">
    <BackButton />
    <h1 className="text-3xl font-bold">{person.full_name || person.email}</h1>
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="mb-3 text-xl font-semibold">Профиль</h2>
      <p>{roles[person.role] || person.role}</p><p>{person.email}</p><p>{person.phone || 'Телефон не указан'}</p>
      <p>Регистрация: {new Date(person.created_at).toLocaleDateString('ru-RU')}</p>
      {person.role === 'driver' && <div className="mt-3 space-y-1">
        <p>Компания: {organization.error ? 'Не удалось загрузить' : !person.organization_id ? 'Не привязан' : organization.data ? (organization.data.organization_name || organization.data.full_name || organization.data.email) : 'Компания недоступна'}</p>
        {organization.data && <p>{organization.data.email} · {organization.data.phone || 'Телефон не указан'}</p>}
        {person.organization_attached_at && <p>Привязан: {new Date(person.organization_attached_at).toLocaleDateString('ru-RU')}</p>}
        <p>Транспорт: {[person.vehicle_brand, person.vehicle_model, person.vehicle_number].filter(Boolean).join(' · ') || 'Не указан'}</p>
      </div>}
    </section>
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-xl font-semibold">Баланс</h2>
      {balance.error ? <p role="alert">Не удалось загрузить баланс.</p> : <>
        <p className="my-2 text-2xl">{money(balance.data?.amount ?? 0, balance.data?.currency || 'BYN')}</p>
        {!balance.data && <p className="text-sm text-gray-600">Балансовый счёт ещё не создан.</p>}
        {person.role === 'driver' && <p className="text-sm text-gray-600">Учтённые средства водителя по операциям системы. Это не размер заработка.</p>}
      </>}
    </section>
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-xl font-semibold">Последние 20 операций</h2>
      {transactions.error ? <p role="alert">Не удалось загрузить операции.</p> : transactions.data?.length ? <ul className="divide-y">{transactions.data.map(item => <li key={item.id} className="py-3">
        <p>{item.type === 'credit' ? '+' : '−'}{money(item.amount, balance.data?.currency || 'BYN')} · {new Date(item.created_at).toLocaleString('ru-RU')}</p><p>{item.description}</p>
      </li>)}</ul> : <p>Операций пока нет.</p>}
    </section>
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-xl font-semibold">Неоплаченные задолженности пользователя</h2>
      <p className="text-sm text-gray-600">До 20 записей, где пользователь указан плательщиком. Не включают долги клиентов по заказам водителя.</p>
      {debts.error ? <p role="alert">Не удалось загрузить задолженности.</p> : debts.data?.length ? <ul>{debts.data.map(item => <li key={item.id}>{money(item.amount, item.currency || 'BYN')}</li>)}</ul> : <p>Задолженностей нет.</p>}
    </section>
    {driverOrders && <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-xl font-semibold">Последние 20 заказов водителя</h2>
      {driverOrders.error ? <p role="alert">Не удалось загрузить заказы.</p> : driverOrders.data?.length ? <ul className="divide-y">{driverOrders.data.map(order => <li key={order.id} className="py-2">№{order.order_number} · {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status} · {money(order.final_price)} · {order.is_paid ? 'Оплачен' : 'Не оплачен'}</li>)}</ul> : <p>Заказов пока нет.</p>}
    </section>}
    <ChangePasswordForm userId={id} />
  </div>
}
