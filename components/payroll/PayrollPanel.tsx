'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Summary = {
  organization_id: string; driver_id: string; driver_name: string | null; organization_name: string | null
  accrued: number; paid: number; outstanding: number; currently_employed: boolean
  monthly_amount: number | null; order_mode: 'none' | 'percent' | 'fixed' | null; order_value: number | null; terms_since: string | null
}
type Entry = { id: string; organization_id: string; driver_id: string; kind: 'order' | 'monthly' | 'payment'; amount: number; created_at: string; order_number: number | null; period_month: string | null; note: string }
type Data = { role: 'customer' | 'driver'; summaries: Summary[]; history: Entry[]; history_total: number }
const money = (value: number | null) => `${Number(value ?? 0).toFixed(2)} BYN`
const numeric = (value: string) => Number(value.replace(',', '.'))
const keyOf = (s: Summary) => `${s.organization_id}:${s.driver_id}`

export function PayrollPanel({ driverId }: { driverId?: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selection, setSelection] = useState('')
  const [busy, setBusy] = useState(false)
  const [monthly, setMonthly] = useState('0')
  const [mode, setMode] = useState<'none' | 'percent' | 'fixed'>('none')
  const [rate, setRate] = useState('0')
  const [action, setAction] = useState<'monthly' | 'payment'>('monthly')
  const [amount, setAmount] = useState('')
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('sv-SE', {timeZone:'Europe/Minsk'}).slice(0,7))
  const [note, setNote] = useState('')
  const [confirming, setConfirming] = useState(false)
  const pending = useRef<{ signature: string; id: string } | null>(null)
  const submitting = useRef(false)
  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/payroll', { cache: 'no-store' })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error?.message || 'Не удалось загрузить зарплату')
      setData(body.data); setError('')
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось загрузить зарплату') }
  }, [])
  useEffect(() => { void load() }, [load])
  const summaries = data?.summaries.filter(s => !driverId || s.driver_id === driverId) ?? []
  const selected = summaries.find(s => keyOf(s) === selection) ?? summaries[0]
  const selectedKey = selected ? keyOf(selected) : ''
  useEffect(() => {
    setMonthly(String(selected?.monthly_amount ?? 0)); setMode(selected?.order_mode ?? 'none'); setRate(String(selected?.order_value ?? 0))
    setAmount(''); setNote(''); setConfirming(false)
  }, [selectedKey, selected?.terms_since])

  async function submit(body: Record<string, unknown>) {
    if (submitting.current) return
    submitting.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/payroll', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'Не удалось сохранить зарплату')
      pending.current = null; setConfirming(false); setAmount(''); setNote('')
      await load(); setNotice(body.action === 'terms' ? 'Условия сохранены. Они действуют для новых принятых заказов.' : 'Запись сохранена.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось сохранить запись') }
    finally { submitting.current = false; setBusy(false) }
  }
  function record() {
    if (!selected) return
    const body = {action, driverId:selected.driver_id, amount:numeric(amount), month:action==='monthly'?`${month}-01`:null, note}
    const signature = JSON.stringify(body)
    if (pending.current?.signature !== signature) pending.current = {signature,id:crypto.randomUUID()}
    void submit({...body,requestId:pending.current.id})
  }
  const input = 'mt-1 w-full rounded border border-gray-300 bg-white p-2 text-gray-900'
  return <section className="my-6 rounded-lg border bg-white p-4 text-gray-900" aria-label="Зарплата водителей">
    <h2 className="text-xl font-semibold">{data?.role === 'driver' ? 'Моя зарплата' : 'Зарплата водителей'}</h2>
    <p className="mt-2 text-sm text-gray-600">Заработок от компании учитывается отдельно от денег, полученных от клиентов. Все суммы в BYN.</p>
    {error && <p role="alert" className="my-2 text-red-700">{error} <button onClick={() => void load()} className="underline">Обновить</button></p>}
    {notice && <p role="status" className="my-2 text-green-700">{notice}</p>}
    {!data && !error && <p className="mt-3">Загрузка зарплаты…</p>}
    {data && !selected && <p className="mt-3">{data.role==='customer'?'Сначала привяжите водителя к компании.':'Нет зарплатных начислений или привязки к компании.'}</p>}
    {selected && <>
      {summaries.length>1 && <label className="mt-4 block">{data?.role==='customer'?'Водитель':'Компания'}<select className={input} value={selectedKey} disabled={busy} onChange={e=>setSelection(e.target.value)}>
        {summaries.map(s=><option key={keyOf(s)} value={keyOf(s)}>{data?.role==='customer'?(s.driver_name||s.driver_id):(s.organization_name||'Компания')}{!s.currently_employed?' (сотрудничество завершено)':''}</option>)}
      </select></label>}
      <p className="mt-3 font-medium">{data?.role==='customer'?(selected.driver_name||'Водитель'):(selected.organization_name||'Компания')}</p>
      <div className="my-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>Начислено за всё время<strong className="block">{money(selected.accrued)}</strong></div>
        <div>Выплачено<strong className="block">{money(selected.paid)}</strong></div>
        <div>Осталось выплатить<strong className="block">{money(selected.outstanding)}</strong></div>
      </div>
      <p className="text-sm">Договорной оклад: {money(selected.monthly_amount)} в месяц. За заказ: {selected.order_mode==='percent'?`${selected.order_value}% от стоимости`:selected.order_mode==='fixed'?money(selected.order_value):'не настроено'}.</p>
      <p className="mt-1 text-sm text-gray-600">Оплата за заказ начисляется после завершения доставки, даже если клиент ещё не оплатил. Используется ставка на момент принятия заказа. Оклад за месяц компания начисляет вручную.</p>
      {data?.role==='customer' && <>
        {selected.currently_employed && <details className="mt-4 rounded border p-3">
          <summary className="cursor-pointer font-medium">Настроить условия зарплаты</summary>
          <form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();void submit({action:'terms',driverId:selected.driver_id,monthlyAmount:numeric(monthly),orderMode:mode,orderValue:mode==='none'?0:numeric(rate)})}}>
            <label className="block">Договорной оклад в месяц, BYN<input className={input} type="number" min="0" step="0.01" required value={monthly} disabled={busy} onChange={e=>setMonthly(e.target.value)}/></label>
            <label className="block">Оплата за завершённый заказ<select className={input} value={mode} disabled={busy} onChange={e=>setMode(e.target.value as typeof mode)}><option value="none">Без оплаты за заказ</option><option value="percent">Процент от стоимости заказа</option><option value="fixed">Фиксированная сумма за заказ</option></select></label>
            {mode!=='none' && <label className="block">{mode==='percent'?'Процент (0–100)':'Сумма, BYN'}<input className={input} type="number" min="0" max={mode==='percent'?100:9999999999.99} step="0.01" required value={rate} disabled={busy} onChange={e=>setRate(e.target.value)}/></label>}
            <p className="text-sm text-gray-600">Новые условия действуют только для заказов, принятых после сохранения. Уже принятые и завершённые заказы не пересчитываются. Старые заказы автоматически не начисляются.</p>
            <button disabled={busy} className="rounded bg-brand-dark px-4 py-2 text-white disabled:opacity-50">Сохранить условия</button>
          </form>
        </details>}
        <details className="mt-4 rounded border p-3">
          <summary className="cursor-pointer font-medium">Начислить оклад или отметить выплату</summary>
          <form className="mt-3 space-y-3" onSubmit={e=>{e.preventDefault();setConfirming(true)}}>
            <fieldset disabled={busy||confirming} className="space-y-3">
              <label className="block">Действие<select className={input} value={action} onChange={e=>setAction(e.target.value as typeof action)}><option value="monthly">Начислить оклад за месяц</option><option value="payment">Отметить фактическую выплату</option></select></label>
              {action==='monthly' && <label className="block">Месяц<input className={input} type="month" required value={month} onChange={e=>setMonth(e.target.value)}/></label>}
              <label className="block">{action==='monthly'?'Сумма оклада за этот месяц, BYN':'Выплаченная сумма, BYN'}<input className={input} type="number" min="0.01" step="0.01" max={action==='payment'?Number(selected.outstanding):9999999999.99} required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
              <label className="block">Комментарий<input className={input} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label>
              <p className="text-sm text-gray-600">{action==='monthly'?'Укажите итоговую сумму вручную, в том числе за неполный месяц. Оклад за один месяц можно начислить один раз.':'Отмечайте только уже переданные водителю деньги. Эта запись не переводит деньги и не списывает клиентскую кассу.'}</p>
              <button className="rounded bg-brand-dark px-4 py-2 text-white">Проверить запись</button>
            </fieldset>
          </form>
          {confirming && <div className="mt-3 rounded bg-amber-50 p-3" role="group" aria-label="Подтверждение записи зарплаты">
            <p>{action==='monthly'?`Начислить оклад за ${month}`:'Подтвердить фактическую выплату'}: <strong>{money(numeric(amount))}</strong> — {selected.driver_name||'водитель'}.</p>
            <p className="text-sm">Проверьте сумму: сохранённую запись нельзя редактировать в этом разделе.</p>
            <div className="mt-2 flex gap-3"><button disabled={busy} onClick={record} className="rounded bg-brand-dark px-4 py-2 text-white">{busy?'Сохранение…':'Подтвердить'}</button><button disabled={busy} onClick={()=>setConfirming(false)}>Назад</button></div>
          </div>}
        </details>
      </>}
      <h3 className="mt-5 font-semibold">История зарплаты</h3>
      <p className="text-sm text-gray-600">Показаны записи из последних 100 операций по всем {data?.role==='customer'?'водителям':'компаниям'}. Итоги выше учитывают всю историю.</p>
      <div className="mt-2 space-y-2">{data?.history.filter(e=>e.driver_id===selected.driver_id&&e.organization_id===selected.organization_id).map(entry=><div key={entry.id} className="rounded border p-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2"><strong>{entry.kind==='order'?`Заказ №${entry.order_number??'—'}`:entry.kind==='monthly'?`Оклад за ${entry.period_month?.slice(0,7)}`:'Выплата'}</strong><span>{money(entry.amount)}</span></div>
        <p>{new Date(entry.created_at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk'})}</p>{entry.note&&<p>{entry.note}</p>}
      </div>)}</div>
      {!data?.history.some(e=>e.driver_id===selected.driver_id&&e.organization_id===selected.organization_id)&&<p className="mt-2 text-sm">В показанной истории записей нет.</p>}
    </>}
  </section>
}
