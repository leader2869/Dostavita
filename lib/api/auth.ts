import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export type ApiRole = 'customer' | 'driver' | 'client' | 'admin' | 'superadmin'

export interface UserProfile {
  id: string
  role: string
  [key: string]: unknown
}

export type AuthResult =
  | { ok: true; user: { id: string }; profile: UserProfile }
  | { ok: false; response: NextResponse }

/**
 * Возвращает текущего пользователя или ответ 401.
 */
export async function getAuthUser(
  supabase: SupabaseClient
): Promise<{ ok: true; user: { id: string; email?: string } } | { ok: false; response: NextResponse }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Не авторизован' }, { status: 401 }),
    }
  }
  return { ok: true, user: { id: user.id, email: user.email ?? '' } }
}

/**
 * Проверяет авторизацию и роль. Возвращает user + profile или ответ 401/403.
 */
export async function requireRole(
  supabase: SupabaseClient,
  allowedRoles: ApiRole | ApiRole[]
): Promise<AuthResult> {
  const auth = await getAuthUser(supabase)
  if (!auth.ok) return auth

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  const { data: profile } = await supabase
    .rpc('get_user_profile', { user_id: auth.user.id })
    .single()

  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Профиль не найден' }, { status: 404 }),
    }
  }

  const userRole = (profile as UserProfile).role
  if (!roles.includes(userRole as ApiRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    user: auth.user,
    profile: profile as UserProfile,
  }
}

/**
 * Для маршрутов admin: роль берётся из таблицы profiles (без RPC).
 */
export async function requireSuperadmin(
  supabase: SupabaseClient
): Promise<AuthResult> {
  const auth = await getAuthUser(supabase)
  if (!auth.ok) return auth

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', auth.user.id)
    .single()

  if (!profile || profile.role !== 'superadmin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Доступ запрещен' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    user: auth.user,
    profile: profile as UserProfile,
  }
}
