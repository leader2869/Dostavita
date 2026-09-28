import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/api/auth'
import { apiSuccess, apiError } from '@/lib/api/response'
import { loadCompanyOrderBoard } from '@/lib/company-order-board'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const auth = await requireRole(supabase,'customer')
  if (!auth.ok) return auth.response
  try { return apiSuccess(await loadCompanyOrderBoard(supabase,auth.user.id,true)) }
  catch { return apiError('Не удалось обновить доску заказов. Повторите попытку.',500) }
}
