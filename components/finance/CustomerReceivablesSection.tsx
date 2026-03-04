'use client'

import { useRouter } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toastError, toastSuccess } from '@/lib/utils/toast'

interface ReceivableItem {
  id: string
  order_id?: string | null
  order_number?: string | null
  amount?: string | number
  driver_full_name?: string | null
  pickup_address?: string | null
  delivery_address?: string | null
  created_at: string
}

interface GroupedDebtor {
  debtor_user_id: string
  debtor_name: string
  debtor_organization_name?: string | null
  debtor_phone?: string | null
  receivables: ReceivableItem[]
  totalAmount: number
  ordersCount: number
}

interface CustomerReceivablesSectionProps {
  debtorsList: GroupedDebtor[]
  expandedDebtors: Set<string>
  toggleDebtor: (id: string) => void
  supabase: SupabaseClient
  onSuccess: () => void
  onExport: () => void
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function CustomerReceivablesSection({
  debtorsList,
  expandedDebtors,
  toggleDebtor,
  supabase,
  onSuccess,
  onExport,
}: CustomerReceivablesSectionProps) {
  const router = useRouter()

  const processSinglePayment = async (receivable: ReceivableItem) => {
    if (!receivable.order_id) {
      toastError('Нет ID заказа. Пожалуйста, обновите страницу.')
      return
    }
    const orderUuid = String(receivable.order_id).trim()
    if (!UUID_REGEX.test(orderUuid)) {
      toastError('Невалидный ID заказа. Пожалуйста, обновите страницу.')
      return
    }
    try {
      const { data, error } = await supabase.rpc('process_order_payment', {
        order_uuid: orderUuid,
        payment_status: true,
      })
      if (error) {
        toastError(error.message)
      } else if (data === false) {
        toastError('Не удалось обработать оплату. Возможно, заказ уже обработан или не найден.')
      } else {
        toastSuccess('Оплата успешно проведена! Деньги начислены на баланс организации.')
        setTimeout(onSuccess, 2000)
      }
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Не удалось обработать оплату')
    }
  }

  const processBatchPayment = async (debtor: GroupedDebtor) => {
    if (
      !confirm(
        `Провести оплату по всем ${debtor.ordersCount} неоплаченным заказам клиента "${debtor.debtor_name}" на общую сумму ${debtor.totalAmount.toFixed(2)} BYN? Деньги будут начислены на баланс организации.`
      )
    )
      return
    let successCount = 0
    let errorCount = 0
    const errors: string[] = []
    for (const receivable of debtor.receivables) {
      if (!receivable.order_id) {
        errorCount++
        errors.push(`Заказ ${receivable.order_number || 'без номера'}: нет ID заказа`)
        continue
      }
      const orderUuid = String(receivable.order_id).trim()
      if (!UUID_REGEX.test(orderUuid)) {
        errorCount++
        errors.push(`Заказ ${receivable.order_number || 'без номера'}: невалидный ID заказа`)
        continue
      }
      const { data, error } = await supabase.rpc('process_order_payment', {
        order_uuid: orderUuid,
        payment_status: true,
      })
      if (error) {
        errorCount++
        errors.push(`Заказ ${receivable.order_number || 'без номера'}: ${error.message}`)
      } else if (data === false) {
        errorCount++
        errors.push(`Заказ ${receivable.order_number || 'без номера'}: не удалось обработать оплату`)
      } else {
        successCount++
      }
    }
    if (successCount > 0) {
      const message =
        errorCount > 0
          ? `Оплата проведена по ${successCount} заказам. Ошибок: ${errorCount}. ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
          : `Оплата успешно проведена по всем ${successCount} заказам! Деньги начислены на баланс организации.`
      toastSuccess(message)
      setTimeout(onSuccess, 2000)
    } else {
      toastError(
        `Не удалось провести оплату ни по одному заказу. Ошибки: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`
      )
    }
  }

  return (
    <div id="receivables-section" className="bg-gray-50 rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">
          Дебиторка (неоплаченные заказы)
        </h2>
        <button
          type="button"
          onClick={onExport}
          className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
          title="Экспорт дебиторки в Excel"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Экспорт
        </button>
      </div>
      {debtorsList && debtorsList.length > 0 ? (
        <div className="space-y-4">
          {debtorsList.map((debtor) => {
            const isExpanded = expandedDebtors.has(debtor.debtor_user_id)
            return (
              <div
                key={debtor.debtor_user_id}
                className="border border-red-500/50 rounded-lg bg-gray-100/50"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-100 transition"
                  onClick={() => toggleDebtor(debtor.debtor_user_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') toggleDebtor(debtor.debtor_user_id)
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {debtor.debtor_organization_name && (
                          <p className="font-semibold text-gray-900 text-lg">
                            {debtor.debtor_organization_name}
                          </p>
                        )}
                        <p className="font-semibold text-gray-900 text-lg">
                          {debtor.debtor_name}
                        </p>
                        {debtor.debtor_phone && (
                          <a
                            href={`tel:${debtor.debtor_phone}`}
                            className="text-brand-light hover:text-brand-dark text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {debtor.debtor_phone}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <p className="text-gray-700">
                          Неоплаченных заказов:{' '}
                          <span className="text-gray-900 font-semibold">{debtor.ordersCount}</span>
                        </p>
                        <p className="text-gray-700">
                          Общая сумма:{' '}
                          <span className="text-red-400 font-semibold">
                            {debtor.totalAmount.toFixed(2)} BYN
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      <p className="text-xl font-bold text-red-400">
                        {debtor.totalAmount.toFixed(2)} BYN
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          processBatchPayment(debtor)
                        }}
                        className="bg-green-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-green-400 transition whitespace-nowrap"
                      >
                        Провести оплату
                      </button>
                      <svg
                        className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-red-500/30 p-4 space-y-3">
                    {debtor.receivables.map((receivable) => (
                      <div
                        key={receivable.id}
                        className="bg-white rounded-lg p-4 border border-gray-200"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p
                                className="font-semibold text-gray-900 text-lg cursor-pointer hover:text-blue-400 transition"
                                onClick={() => {
                                  if (receivable.order_id) {
                                    router.push(`/dashboard/customer/orders/${receivable.order_id}`)
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                              >
                                Заказ{' '}
                                {receivable.order_number
                                  ? `№${receivable.order_number}`
                                  : 'без номера'}
                              </p>
                              <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded">
                                Не оплачен
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-sm">
                              <p className="text-gray-700">
                                Сумма:{' '}
                                <span className="text-red-400 font-semibold">
                                  {parseFloat(String(receivable.amount || 0)).toFixed(2)} BYN
                                </span>
                              </p>
                              <p className="text-gray-700">
                                Водитель:{' '}
                                <span className="text-gray-900">
                                  {receivable.driver_full_name || 'Неизвестно'}
                                </span>
                              </p>
                              {receivable.pickup_address && (
                                <p className="text-gray-600 text-xs mt-1">
                                  Откуда: {receivable.pickup_address}
                                </p>
                              )}
                              {receivable.delivery_address && (
                                <p className="text-gray-600 text-xs">
                                  Куда: {receivable.delivery_address}
                                </p>
                              )}
                              <p className="text-gray-600 text-xs mt-1">
                                Дата:{' '}
                                {new Date(receivable.created_at).toLocaleString('ru-RU', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="ml-4 flex flex-col items-end">
                            <p className="text-xl font-bold text-red-400 mb-2">
                              {parseFloat(String(receivable.amount || 0)).toFixed(2)} BYN
                            </p>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (
                                  !confirm(
                                    `Провести оплату заказа №${receivable.order_number || 'без номера'}? Деньги будут начислены на баланс организации.`
                                  )
                                )
                                  return
                                processSinglePayment(receivable)
                              }}
                              className="bg-brand-light text-gray-900 px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
                            >
                              Провести оплату
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600 mb-2">Нет дебиторки за выбранный период</p>
          <p className="text-gray-500 text-sm">
            Дебиторка появляется, когда водитель отмечает заказ как &quot;не оплачен&quot; после
            завершения доставки
          </p>
        </div>
      )}
    </div>
  )
}
