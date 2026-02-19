'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { formatDistanceToNow } from 'date-fns'
import { ru } from 'date-fns/locale'

export default function DriverRequestsPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [responding, setResponding] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/driver/requests')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка загрузки запросов')
      }

      setRequests(data.requests || [])
    } catch (err: any) {
      console.error('Ошибка загрузки запросов:', err)
      setError(err.message)
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleRespond = async (requestId: string, response: 'accepted' | 'rejected') => {
    if (!confirm(response === 'accepted' 
      ? 'Вы уверены, что хотите принять запрос и привязаться к этой организации?'
      : 'Вы уверены, что хотите отклонить запрос?')) {
      return
    }

    setResponding(requestId)
    setError(null)

    try {
      const fetchResponse = await fetch(`/api/driver/requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response }),
      })

      const data = await fetchResponse.json()

      if (!fetchResponse.ok) {
        throw new Error(data.error || 'Ошибка обработки запроса')
      }

      alert(data.message)
      await loadRequests() // Обновляем список запросов
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResponding(null)
    }
  }

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Запросы организаций</h1>
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Запросы организаций</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((request: any) => (
            <div
              key={request.id}
              className="bg-gray-50 rounded-lg shadow p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {request.organization_name || 'Организация'}
                  </h3>
                  <p className="text-gray-600 text-sm mb-1">
                    Email: {request.organization_email}
                  </p>
                  {request.message && (
                    <div className="mt-3 p-3 bg-gray-100 rounded">
                      <p className="text-sm text-gray-700">{request.message}</p>
                    </div>
                  )}
                  <p className="text-gray-500 text-xs mt-3">
                    Получен: {formatDistanceToNow(new Date(request.created_at), { addSuffix: true, locale: ru })}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleRespond(request.id, 'accepted')}
                  disabled={responding === request.id}
                  className="flex-1 bg-brand-light text-gray-900 px-4 py-2 rounded-md hover:bg-brand-dark disabled:opacity-50 transition"
                >
                  {responding === request.id ? 'Обработка...' : 'Принять'}
                </button>
                <button
                  onClick={() => handleRespond(request.id, 'rejected')}
                  disabled={responding === request.id}
                  className="flex-1 bg-red-600 text-gray-900 px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 transition"
                >
                  {responding === request.id ? 'Обработка...' : 'Отклонить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-lg shadow p-6 text-center">
          <p className="text-gray-600">У вас пока нет запросов от организаций</p>
        </div>
      )}
    </div>
  )
}

