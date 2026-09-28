import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { parseBody } from '@/lib/api/validate'
import { apiError, apiSuccess } from '@/lib/api/response'

const money = z.number().finite().min(0).max(9999999999.99).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001)
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('terms'), driverId: z.string().uuid(), monthlyAmount: money,
    orderMode: z.enum(['none','percent','fixed']), orderValue: money }),
  z.object({ action: z.enum(['monthly','payment']), driverId: z.string().uuid(), amount: money.refine(v => v > 0),
    month: z.string().regex(/^\d{4}-\d{2}-01$/).nullable(), requestId: z.string().uuid(), note: z.string().max(500).default('') }),
])

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const auth = await requireRole(supabase, ['customer','driver'])
  if (!auth.ok) return auth.response
  const { data, error } = await supabase.rpc('get_my_payroll')
  if (error) return apiError('Не удалось загрузить зарплату. Повторите попытку.', 500)
  return apiSuccess(data)
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient()
  const auth = await requireRole(supabase, 'customer')
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, actionSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const result = body.action === 'terms'
    ? await supabase.rpc('set_driver_payroll_terms', { p_driver_id: body.driverId, p_monthly_amount: body.monthlyAmount, p_order_mode: body.orderMode, p_order_value: body.orderValue })
    : await supabase.rpc('record_driver_payroll', { p_driver_id: body.driverId, p_kind: body.action, p_amount: body.amount,
      p_period_month: body.month, p_request_id: body.requestId, p_note: body.note })
  if (result.error) {
    if (result.error.code === '42501') return apiError('Нет доступа к зарплате этого водителя', 403)
    if (result.error.code === '22023') return apiError(result.error.message, 400)
    return apiError('Не удалось сохранить запись зарплаты', 500)
  }
  return apiSuccess({ id: result.data })
}
