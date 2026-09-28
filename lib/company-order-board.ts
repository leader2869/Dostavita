import type { SupabaseClient } from '@supabase/supabase-js'

export const BOARD_STATUSES = ['searching_courier','courier_accepted','courier_coming','courier_delivering','completed','cancelled'] as const
export type BoardStatus = typeof BOARD_STATUSES[number]
export type BoardOrder = {
  id: string; order_number: number | null; status: BoardStatus; customer_id: string
  executor_user_id: string | null; payment_organization_id: string | null; visibility: string
  pickup_address: string; delivery_address: string; final_price: number; created_at: string
  ready_at: string | null; is_paid: boolean | null
}
export type BoardDriver = { id: string; full_name: string | null }
export type CompanyBoardData = { orders: BoardOrder[]; drivers: BoardDriver[] }
const fields = 'id,order_number,status,customer_id,executor_user_id,payment_organization_id,visibility,pickup_address,delivery_address,final_price,created_at,ready_at,is_paid'

async function pages(build: () => any): Promise<BoardOrder[]> {
  const rows: BoardOrder[] = []
  for (let offset=0;;offset+=100) {
    const {data,error} = await build().order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+99)
    if (error) throw new Error('Unable to load company order board')
    rows.push(...(data??[]))
    if (!data || data.length<100) return rows
  }
}

export async function loadCompanyOrderBoard(supabase: SupabaseClient, organizationId: string, includePublic: boolean): Promise<CompanyBoardData> {
  const {data:drivers,error} = await supabase.rpc('get_organization_drivers',{organization_user_id:organizationId})
  if (error) throw new Error('Unable to load company drivers')
  const ids: string[] = (drivers??[]).map((driver: BoardDriver)=>driver.id)
  const jobs = [
    pages(()=>supabase.from('orders').select(fields).eq('customer_id',organizationId)),
    pages(()=>supabase.from('orders').select(fields).eq('payment_organization_id',organizationId)),
  ]
  if (includePublic) jobs.push(pages(()=>supabase.from('orders').select(fields).eq('status','searching_courier').eq('visibility','public')))
  for(let offset=0;offset<ids.length;offset+=100) {
    jobs.push(pages(()=>supabase.from('orders').select(fields).in('executor_user_id',ids.slice(offset,offset+100))))
  }
  const batches = await Promise.all(jobs)
  const unique = new Map<string,BoardOrder>()
  for(const order of batches.flat()) unique.set(order.id,order)
  return {orders:[...unique.values()].sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id.localeCompare(a.id)),
    drivers:(drivers??[]).map((driver: BoardDriver)=>({id:driver.id,full_name:driver.full_name}))}
}

export function groupBoardOrders(orders: BoardOrder[], search: string, driverId: string) {
  const groups: Record<BoardStatus,BoardOrder[]> = {searching_courier:[],courier_accepted:[],courier_coming:[],courier_delivering:[],completed:[],cancelled:[]}
  const term=search.trim().toLocaleLowerCase('ru-RU')
  for (const order of orders) {
    if (driverId && order.executor_user_id!==driverId) continue
    if (term && !`${order.order_number??''} ${order.pickup_address} ${order.delivery_address}`.toLocaleLowerCase('ru-RU').includes(term)) continue
    groups[order.status]?.push(order)
  }
  return groups
}
