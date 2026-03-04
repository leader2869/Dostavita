import type { SupabaseClient } from '@supabase/supabase-js'
import type { Balance } from '@/lib/types'

/**
 * Загружает баланс пользователя. Если записи нет (PGRST116), создаёт нулевой баланс и возвращает его.
 * Используется на страницах финансов и везде, где нужен гарантированный баланс.
 */
export async function fetchOrCreateBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<Balance | null> {
  const { data, error } = await supabase
    .from('balances')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('Ошибка загрузки баланса:', error)
    return null
  }

  if (data) return data as Balance

  const { data: newBalance, error: insertError } = await supabase
    .from('balances')
    .insert({
      user_id: userId,
      amount: 0,
      currency: 'BYN',
    })
    .select()
    .single()

  if (insertError) {
    console.error('Ошибка создания баланса:', insertError)
    return null
  }
  return newBalance as Balance
}
