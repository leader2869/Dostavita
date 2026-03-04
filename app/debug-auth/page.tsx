'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugAuthPage() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session: sessionData } } = await supabase.auth.getSession()
        setSession(sessionData)
        const { data: { user: userData } } = await supabase.auth.getUser()
        setUser(userData)
      } catch (err: any) {
        const msg = err?.message ?? ''
        if (msg.includes('Supabase:') || msg.includes('NEXT_PUBLIC_SUPABASE')) {
          setConfigError('Задайте NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в .env.local')
        }
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  if (loading) return <div>Загрузка...</div>
  if (configError) return <div className="p-8 text-red-600">{configError}</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Отладка аутентификации</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Session:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="font-semibold">User:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="font-semibold">Cookies:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {typeof document !== 'undefined' ? document.cookie : 'N/A'}
          </pre>
        </div>
      </div>
    </div>
  )
}






