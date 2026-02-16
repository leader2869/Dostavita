'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function DebugAuthPage() {
  const [session, setSession] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      
      // Проверяем сессию
      const { data: { session: sessionData } } = await supabase.auth.getSession()
      setSession(sessionData)
      
      // Проверяем пользователя
      const { data: { user: userData }, error } = await supabase.auth.getUser()
      setUser(userData)
      
      console.log('Debug Auth - Session:', sessionData)
      console.log('Debug Auth - User:', userData)
      console.log('Debug Auth - Error:', error)
      
      setLoading(false)
    }
    
    checkAuth()
  }, [])

  if (loading) {
    return <div>Загрузка...</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Отладка аутентификации</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Session:</h2>
          <pre className="bg-gray-700 p-4 rounded overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="font-semibold">User:</h2>
          <pre className="bg-gray-700 p-4 rounded overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
        
        <div>
          <h2 className="font-semibold">Cookies:</h2>
          <pre className="bg-gray-700 p-4 rounded overflow-auto">
            {typeof document !== 'undefined' ? document.cookie : 'N/A'}
          </pre>
        </div>
      </div>
    </div>
  )
}



