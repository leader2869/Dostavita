/**
 * Кэширование auth + профиля в рамках одного запроса (RSC).
 * Убирает дублирование getUser/get_user_profile между layout и страницами.
 */
import { cache } from 'react'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { User } from '@/lib/types'

const AUTH_RETRIES = 2
const AUTH_RETRY_DELAY_MS = 500

export const getCachedUserAndProfile = cache(async (): Promise<{
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null
  profile: User | null
  authError: Error | null
}> => {
  const supabase = createServerSupabaseClient()

  let user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null
  let authError: Error | null = null

  for (let attempt = 1; attempt <= AUTH_RETRIES; attempt++) {
    try {
      const result = await supabase.auth.getUser()
      user = result.data.user
      authError = result.error as Error | null

      if (user || (authError && !authError.message?.includes('fetch failed') && !authError.message?.includes('timeout'))) {
        break
      }
      if (authError && (authError.message?.includes('fetch failed') || authError.message?.includes('timeout')) && attempt < AUTH_RETRIES) {
        await new Promise((r) => setTimeout(r, AUTH_RETRY_DELAY_MS))
        continue
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : ''
      authError = err instanceof Error ? err : new Error(String(err))
      if ((message.includes('fetch failed') || message.includes('timeout')) && attempt < AUTH_RETRIES) {
        await new Promise((r) => setTimeout(r, AUTH_RETRY_DELAY_MS))
        continue
      }
      break
    }
  }

  if (!user) {
    return { user: null, profile: null, authError }
  }

  let profile: User | null = null
  let { data: profileData, error: profileError } = await supabase
    .rpc('get_user_profile', { user_id: user.id })
    .single()

  if (profileError || !profileData) {
    const { data: directProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    if (directProfile) {
      profileData = directProfile
      profileError = null
    }
  }

  if (profileError?.code === 'PGRST116') {
    const userRole = (user.user_metadata?.role as string) || 'client'
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name: (user.user_metadata?.full_name as string) ?? null,
        phone: (user.user_metadata?.phone as string) ?? null,
        role: userRole,
      })
      .select()
      .single()

    if (createError) {
      console.error('cached-auth: ошибка создания профиля', createError)
      return { user, profile: null, authError: createError as unknown as Error }
    }
    profile = newProfile as User
    await supabase.from('balances').upsert({ user_id: user.id, amount: 0.0, currency: 'BYN' })
  } else if (profileError) {
    console.error('cached-auth: ошибка загрузки профиля', profileError)
    return { user, profile: null, authError: profileError as unknown as Error }
  } else if (profileData) {
    profile = profileData as User
  }

  return { user, profile, authError: null }
})
