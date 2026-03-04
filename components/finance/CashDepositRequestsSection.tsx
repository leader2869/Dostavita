'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { toastError, toastSuccess } from '@/lib/utils/toast'

interface CashDepositRequest {
  id: string
  amount: string | number
  status: string
  created_at: string
  approved_at?: string | null
  rejected_at?: string | null
  profiles?: { full_name?: string } | null
}

interface CashDepositRequestsSectionProps {
  requests: CashDepositRequest[]
  supabase: SupabaseClient
  onSuccess: () => void
}

export function CashDepositRequestsSection({
  requests,
  supabase,
  onSuccess,
}: CashDepositRequestsSectionProps) {
  const pending = requests.filter((r) => r.status === 'pending')
  if (pending.length === 0) return null

  const handleApprove = async (request: CashDepositRequest) => {
    if (
      !confirm(
        `Принять запрос на сдачу кассы от ${request.profiles?.full_name || 'водителя'} на сумму ${request.amount} BYN?`
      )
    )
      return
    try {
      const { data, error } = await supabase.rpc('approve_cash_deposit_request', {
        request_id: request.id,
      })
      if (error) {
        toastError(error.message)
      } else if (data === false) {
        toastError('Не удалось принять запрос')
      } else {
        toastSuccess('Запрос принят! Деньги переведены на баланс организации.')
        onSuccess()
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Не удалось принять запрос')
    }
  }

  const handleReject = async (request: CashDepositRequest) => {
    if (
      !confirm(
        `Отклонить запрос на сдачу кассы от ${request.profiles?.full_name || 'водителя'}?`
      )
    )
      return
    try {
      const { data, error } = await supabase.rpc('reject_cash_deposit_request', {
        request_id: request.id,
      })
      if (error) {
        toastError(error.message)
      } else if (data === false) {
        toastError('Не удалось отклонить запрос')
      } else {
        toastSuccess('Запрос отклонен')
        onSuccess()
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Не удалось отклонить запрос')
    }
  }

  const statusLabel: Record<string, string> = {
    pending: 'Ожидает принятия',
    approved: 'Принято',
    rejected: 'Отклонено',
    cancelled: 'Отменено',
  }

  return (
    <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Запросы на сдачу кассы</h2>
      <div className="space-y-3">
        {pending.map((request) => (
          <div
            key={request.id}
            className="border border-blue-500/50 rounded-lg p-4 bg-gray-100/50"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-semibold text-gray-900 text-lg">
                    {request.profiles?.full_name || 'Водитель без имени'}
                  </p>
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      request.status === 'pending'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : request.status === 'approved'
                          ? 'bg-brand-light/20 text-brand-light'
                          : request.status === 'rejected'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-gray-500/20 text-gray-600'
                    }`}
                  >
                    {statusLabel[request.status] ?? request.status}
                  </span>
                </div>
                <p className="text-xl font-bold text-blue-400 mb-2">
                  {parseFloat(String(request.amount || 0)).toFixed(2)} BYN
                </p>
                <p className="text-gray-600 text-xs">
                  Дата запроса:{' '}
                  {new Date(request.created_at).toLocaleString('ru-RU', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {request.approved_at && (
                  <p className="text-brand-light text-xs mt-1">
                    Принято:{' '}
                    {new Date(request.approved_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
                {request.rejected_at && (
                  <p className="text-red-400 text-xs mt-1">
                    Отклонено:{' '}
                    {new Date(request.rejected_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                )}
              </div>
              {request.status === 'pending' && (
                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => handleApprove(request)}
                    className="bg-green-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-green-400 transition"
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(request)}
                    className="bg-red-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-red-400 transition"
                  >
                    Отклонить
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
