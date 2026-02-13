import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useAuthCheck(redirectOnFail = true) {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const checkAuth = async () => {
      try {
        // Проверяем сессию перед getUser
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.warn('Session error:', sessionError)
          // Не редиректим сразу, пробуем обновить сессию
          const { data: { user: refreshedUser }, error: refreshError } = await supabase.auth.getUser()
          
          if (refreshError || !refreshedUser) {
            if (mounted) {
              setError('Ошибка аутентификации')
              if (redirectOnFail) {
                router.push('/login')
              }
            }
            return
          }
          
          if (mounted) {
            setUser(refreshedUser)
          }
        } else if (session?.user) {
          if (mounted) {
            setUser(session.user)
          }
        } else {
          // Нет сессии, пробуем getUser
          const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
          
          if (userError) {
            console.warn('GetUser error:', userError)
            // Проверяем, не является ли это просто проблемой сети
            if (userError.message?.includes('network') || userError.message?.includes('fetch')) {
              // Проблема сети - не редиректим, просто показываем ошибку
              if (mounted) {
                setError('Проблема с сетью. Проверьте подключение.')
              }
              return
            }
            
            if (mounted) {
              setError('Ошибка аутентификации')
              if (redirectOnFail) {
                router.push('/login')
              }
            }
            return
          }
          
          if (mounted) {
            setUser(currentUser)
          }
        }
      } catch (err: any) {
        console.error('Auth check error:', err)
        if (mounted) {
          setError(err.message || 'Ошибка проверки аутентификации')
          // Не редиректим при ошибках сети
          if (redirectOnFail && !err.message?.includes('network') && !err.message?.includes('fetch')) {
            router.push('/login')
          }
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    checkAuth()

    // Слушаем изменения аутентификации
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        if (event === 'SIGNED_OUT' || !session) {
          setUser(null)
          if (redirectOnFail) {
            router.push('/login')
          }
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setUser(session.user)
          setError(null)
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router, redirectOnFail])

  return { user, loading, error }
}

