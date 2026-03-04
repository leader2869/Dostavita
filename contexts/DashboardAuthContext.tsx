'use client'

import { createContext, useContext, useMemo } from 'react'
import type { User } from '@/lib/types'

export interface DashboardAuthUser {
  id: string
  email?: string
}

export interface DashboardAuthValue {
  user: DashboardAuthUser
  profile: User
  /** Удобный алиас: id текущего пользователя */
  userId: string
}

const DashboardAuthContext = createContext<DashboardAuthValue | null>(null)

export interface DashboardAuthProviderProps {
  user: DashboardAuthUser
  profile: User
  children: React.ReactNode
}

export function DashboardAuthProvider({ user, profile, children }: DashboardAuthProviderProps) {
  const value = useMemo<DashboardAuthValue>(
    () => ({ user, profile, userId: user.id }),
    [user.id, user.email, profile]
  )
  return (
    <DashboardAuthContext.Provider value={value}>
      {children}
    </DashboardAuthContext.Provider>
  )
}

export function useDashboardUser(): DashboardAuthValue {
  const value = useContext(DashboardAuthContext)
  if (!value) {
    throw new Error('useDashboardUser должен использоваться внутри DashboardAuthProvider (страницы дашборда)')
  }
  return value
}

/** Безопасная версия: возвращает null вне провайдера (например, в общих компонентах) */
export function useDashboardUserOptional(): DashboardAuthValue | null {
  return useContext(DashboardAuthContext)
}
