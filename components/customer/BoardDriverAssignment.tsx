'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { BoardDriver } from '@/lib/company-order-board'

export function BoardDriverAssignment({orderId,drivers,onAssigned}:{orderId:string;drivers:BoardDriver[];onAssigned:()=>Promise<void>}) {
  const [driverId,setDriverId]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const lock=useRef(false)
  async function assign() {
    if(lock.current || !drivers.some(driver=>driver.id===driverId)) return
    lock.current=true;setBusy(true);setError('')
    try {
      const result=await createClient().rpc('accept_order',{order_uuid:orderId,driver_user_uuid:driverId})
      if(result.error) throw new Error('Не удалось назначить водителя. Проверьте соединение и данные водителя.')
      if(result.data!==true) throw new Error('Заказ уже принят или недоступен. Обновите доску и проверьте водителя.')
      await onAssigned()
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Не удалось назначить водителя.')
    }finally{lock.current=false;setBusy(false)}
  }
  return <div className="border-t p-3">
    {drivers.length===0?<p className="text-xs text-gray-500">Добавьте водителя в компанию для назначения.</p>:<>
      <label className="block text-xs text-gray-600">Водитель компании
        <select value={driverId} disabled={busy} onChange={event=>setDriverId(event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-sm text-gray-900">
          <option value="">Выберите водителя</option>
          {drivers.map(driver=><option key={driver.id} value={driver.id}>{driver.full_name||'Без имени'}</option>)}
        </select>
      </label>
      <button type="button" disabled={busy||!driverId} onClick={()=>void assign()} className="mt-2 w-full rounded-lg bg-brand-dark p-2 text-sm font-medium text-white disabled:opacity-50">{busy?'Назначаем…':'Назначить водителя'}</button>
    </>}
    {error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
  </div>
}
