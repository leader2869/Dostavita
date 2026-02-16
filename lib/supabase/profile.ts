// Утилита для получения профиля пользователя с обходом RLS
import { SupabaseClient } from '@supabase/supabase-js'

export async function getUserProfile(
  supabase: SupabaseClient,
  userId: string
) {
  // Пробуем получить профиль через RPC функцию (обходит RLS)
  let { data: profile, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id: userId })
    .single()
  
  // Fallback на прямой запрос, если RPC не работает
  if (profileError || !profile) {
    const { data: directProfile, error: directError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    
    if (directProfile && !directError) {
      return { data: directProfile, error: null }
    }
  }
  
  return { data: profile, error: profileError }
}



