import type { SupabaseClient } from '@supabase/supabase-js'

const fields = 'id, order_number, pickup_address, delivery_address, final_price, item_type, description, created_at, cancelled_at, status, ready_at'
const activeFields = fields + ', customer_id, client_id, executor_user_id, sender_phone, recipient_phone, pickup_coordinates, delivery_coordinates'
const pageSize = 100

// Read every page before partitioning: hidden orders must not consume the visible limit.
// The caller uses the signed-in client, so normal order RLS remains in force.
async function readPages(query: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: unknown }>) {
  const rows: any[] = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query(offset, offset + pageSize - 1)
    if (error) throw new Error('Failed to load driver orders')
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

export async function loadDriverDashboardOrders(supabase: SupabaseClient, driverId: string) {
  const [available, rejections, active] = await Promise.all([
    readPages((from, to) => supabase.from('orders').select(fields)
      .eq('status', 'searching_courier').order('created_at', { ascending: false })
      .order('id', { ascending: false }).range(from, to)),
    readPages((from, to) => supabase.from('order_rejections').select('order_id')
      .eq('driver_user_id', driverId).order('order_id').range(from, to)),
    readPages((from, to) => supabase.from('orders').select(activeFields)
      .eq('executor_user_id', driverId).in('status', ['courier_accepted', 'courier_coming', 'courier_delivering'])
      .order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
  ])
  const hiddenIds = new Set(rejections.map(row => row.order_id))
  return {
    available: available.filter(order => !hiddenIds.has(order.id)),
    hidden: available.filter(order => hiddenIds.has(order.id)),
    active,
  }
}
