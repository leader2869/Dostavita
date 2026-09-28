'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BOARD_STATUSES, groupBoardOrders, type BoardStatus, type CompanyBoardData } from '@/lib/company-order-board'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

const columns: Record<BoardStatus,{title:string;color:string}> = {
  searching_courier:{title:'Ищут водителя',color:'border-amber-400 bg-amber-50'},
  courier_accepted:{title:'Водитель принял',color:'border-sky-400 bg-sky-50'},
  courier_coming:{title:'Едет к отправителю',color:'border-indigo-400 bg-indigo-50'},
  courier_delivering:{title:'Доставляет',color:'border-violet-400 bg-violet-50'},
  completed:{title:'Завершены',color:'border-emerald-400 bg-emerald-50'},
  cancelled:{title:'Отменены',color:'border-rose-300 bg-rose-50'},
}

export function CompanyOrderBoard({initialData,organizationId}:{initialData:CompanyBoardData;organizationId:string}) {
  const [data,setData]=useState(initialData)
  const [search,setSearch]=useState('')
  const [driverId,setDriverId]=useState('')
  const [error,setError]=useState('')
  const [refreshing,setRefreshing]=useState(false)
  const [updated,setUpdated]=useState<string|null>(null)
  const [limits,setLimits]=useState<Record<string,number>>({})
  const inFlight=useRef(false)
  const request=useRef<AbortController|null>(null)
  const mounted=useRef(false)
  const refresh=useCallback(async()=>{
    if(inFlight.current || !mounted.current) return
    inFlight.current=true;setRefreshing(true)
    const controller=new AbortController();request.current=controller
    const timeout=window.setTimeout(()=>controller.abort(),15000)
    try {
      const response=await fetch('/api/customer/order-board',{cache:'no-store',signal:controller.signal})
      const result=await response.json()
      if(!response.ok) throw new Error('Не удалось обновить доску. Показанные данные могут быть устаревшими.')
      if(mounted.current){setData(result.data);setError('');setUpdated(new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}))}
    }catch{
      if(mounted.current) setError('Не удалось обновить доску. Показанные данные могут быть устаревшими.')
    }finally{
      window.clearTimeout(timeout);inFlight.current=false
      if(mounted.current) setRefreshing(false)
    }
  },[])
  useEffect(()=>{setData(initialData)},[initialData])
  useEffect(()=>{
    mounted.current=true
    const supabase=createClient()
    let debounce:number|undefined
    const schedule=()=>{window.clearTimeout(debounce);debounce=window.setTimeout(()=>void refresh(),500)}
    const channel=supabase.channel(`company-board-${organizationId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'orders'},schedule)
      .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},schedule).subscribe()
    const visibleRefresh=()=>{if(document.visibilityState==='visible') void refresh()}
    const interval=window.setInterval(visibleRefresh,30000)
    window.addEventListener('online',visibleRefresh)
    document.addEventListener('visibilitychange',visibleRefresh)
    return()=>{mounted.current=false;request.current?.abort();window.clearInterval(interval);window.clearTimeout(debounce);window.removeEventListener('online',visibleRefresh);document.removeEventListener('visibilitychange',visibleRefresh);void supabase.removeChannel(channel)}
  },[organizationId,refresh])
  const groups=useMemo(()=>groupBoardOrders(data.orders,search,driverId),[data.orders,search,driverId])
  const names=new Map(data.drivers.map(driver=>[driver.id,driver.full_name]))
  const active=BOARD_STATUSES.slice(0,4).reduce((sum,status)=>sum+groups[status].length,0)
  return <section aria-label="Доска заказов" className="mb-8 min-w-0">
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold text-gray-900">Доска заказов</h1><p className="mt-1 text-sm text-gray-600">Свои заказы, доставки ваших водителей и общедоступные заказы в поиске водителя.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/dashboard/customer/create-order" className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-medium text-white">Создать заказ</Link><Link href="/dashboard/customer/available-orders" className="rounded-lg border bg-white px-4 py-2 text-sm text-gray-900">Назначить водителя</Link></div>
    </div>
    <div className="mb-4 grid grid-cols-3 gap-2 text-gray-900">
      <div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-600">В работе и поиске</p><strong className="text-2xl">{active}</strong></div>
      <div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-600">Завершены</p><strong className="text-2xl">{groups.completed.length}</strong></div>
      <div className="rounded-xl border bg-white p-3"><p className="text-xs text-gray-600">Водителей компании</p><strong className="text-2xl">{data.drivers.length}</strong></div>
    </div>
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <label className="min-w-0 flex-1 text-sm text-gray-700">Поиск заказа<input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimits({})}} placeholder="Номер или адрес" className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-gray-900"/></label>
      <label className="text-sm text-gray-700">Водитель<select value={driverId} onChange={e=>{setDriverId(e.target.value);setLimits({})}} className="mt-1 block max-w-full rounded-lg border bg-white px-3 py-2 text-gray-900"><option value="">Все водители</option>{data.drivers.map(driver=><option key={driver.id} value={driver.id}>{driver.full_name||'Без имени'}</option>)}</select></label>
      <button disabled={refreshing} onClick={()=>void refresh()} className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-50">{refreshing?'Обновление…':'Обновить доску'}</button>
    </div>
    {error&&<p role="alert" className="mb-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <p className="mb-3 text-xs text-gray-500">Все даты. Статусы обновляются автоматически.{updated&&` Обновлено в ${updated}.`} Прокрутите доску вправо, чтобы увидеть следующие статусы.</p>
    <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-proximity" tabIndex={0} aria-label="Колонки статусов заказов">
      {BOARD_STATUSES.map(status=>{
        const info=columns[status];const orders=groups[status];const limit=limits[status]??20
        return <section key={status} aria-label={info.title} className={`w-[min(82vw,280px)] shrink-0 snap-start rounded-xl border-t-4 ${info.color}`}>
          <header className="flex items-center justify-between gap-2 p-3"><h2 className="text-sm font-bold text-gray-900">{info.title}</h2><span className="rounded-full bg-white px-2 py-0.5 text-sm font-semibold text-gray-700">{orders.length}</span></header>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto px-3 pb-3">
            {orders.length===0&&<p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">Нет заказов</p>}
            {orders.slice(0,limit).map(order=><Link key={order.id} href={`/dashboard/customer/orders/${order.id}`} className="block rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:border-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-dark">
              <div className="mb-3 flex items-center justify-between gap-2"><strong className="text-sm text-gray-900">№{order.order_number??order.id.slice(0,8)}</strong><span className="text-sm font-semibold text-gray-900">{Number(order.final_price).toFixed(2)} BYN</span></div>
              <p className="text-xs font-medium uppercase text-gray-400">Откуда</p><p className="break-words text-sm text-gray-800">{formatAddressForOrder(order.pickup_address)}</p>
              <p className="mt-2 text-xs font-medium uppercase text-gray-400">Куда</p><p className="break-words text-sm text-gray-800">{formatAddressForOrder(order.delivery_address)}</p>
              <div className="mt-3 border-t pt-2 text-xs text-gray-600">
                <p>{order.executor_user_id?(names.get(order.executor_user_id)||'Водитель назначен'):'Водитель не назначен'}</p>
                {status==='searching_courier'&&order.customer_id!==organizationId&&<p className="mt-1 text-amber-700">Общедоступный заказ</p>}
                {order.ready_at&&<p className="mt-1">Готовность: {new Date(order.ready_at).toLocaleString('ru-RU',{timeZone:'Europe/Minsk',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>}
                {status==='completed'&&<p className={order.is_paid?'mt-1 text-green-700':'mt-1 text-red-700'}>{order.is_paid?'Оплачен':'Не оплачен'}</p>}
              </div>
            </Link>)}
            {orders.length>limit&&<button onClick={()=>setLimits(previous=>({...previous,[status]:limit+20}))} className="w-full rounded-lg border bg-white p-2 text-sm text-gray-700">Показать ещё ({orders.length-limit})</button>}
          </div>
        </section>
      })}
    </div>
  </section>
}
