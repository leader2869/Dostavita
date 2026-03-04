'use client'

import type { OrganizationFinanceRow } from '@/lib/types'

interface CustomerFinanceDriversProps {
  finances: OrganizationFinanceRow[]
  receivables: { driver_user_id?: string; amount?: string | number }[]
  onWithdraw: (driver: OrganizationFinanceRow) => void
}

export function CustomerFinanceDrivers({
  finances,
  receivables,
  onWithdraw,
}: CustomerFinanceDriversProps) {
  return (
    <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Финансы по водителям</h2>
      {finances && finances.length > 0 ? (
        <div className="space-y-4">
          {finances.map((finance) => {
            const driverReceivables = receivables.filter(
              (r) => r.driver_user_id === finance.driver_id
            )
            const driverReceivablesTotal = driverReceivables.reduce(
              (sum, r) => sum + (parseFloat(String(r.amount)) || 0),
              0
            )
            const balanceNum = Number(finance.balance ?? 0)
            return (
              <div
                key={finance.driver_id}
                className="border border-gray-200 rounded-lg p-4 bg-gray-100"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 text-lg">
                      {finance.driver_full_name || 'Без имени'}
                    </p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p className="text-gray-700">
                        Завершенных заказов:{' '}
                        <span className="text-gray-900 font-semibold">
                          {finance.completed_orders_count || 0}
                        </span>
                      </p>
                      <p className="text-gray-700">
                        Общая сумма:{' '}
                        <span className="text-brand-light font-semibold">
                          {Number(finance.total_earnings ?? 0).toFixed(2)} BYN
                        </span>
                      </p>
                      <p className="text-gray-700">
                        Баланс:{' '}
                        <span className="text-blue-400 font-semibold">
                          {balanceNum.toFixed(2)} BYN
                        </span>
                      </p>
                      {driverReceivablesTotal > 0 && (
                        <p className="text-gray-700">
                          Дебиторка:{' '}
                          <span className="text-red-400 font-semibold">
                            {driverReceivablesTotal.toFixed(2)} BYN
                          </span>
                          <span className="text-gray-500 text-xs ml-1">
                            ({driverReceivables.length}{' '}
                            {driverReceivables.length === 1 ? 'заказ' : 'заказов'})
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {balanceNum > 0 && (
                      <button
                        type="button"
                        onClick={() => onWithdraw(finance)}
                        className="bg-green-300 text-gray-900 px-4 py-2 rounded text-sm hover:bg-green-400 transition"
                      >
                        Забрать кассу
                      </button>
                    )}
                    <a
                      href={`/dashboard/customer/drivers/${finance.driver_id}`}
                      className="bg-brand-light text-gray-900 px-4 py-2 rounded text-sm hover:bg-brand-dark transition"
                    >
                      Подробнее
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-gray-600 text-center py-8">Нет данных за выбранный период</p>
      )}
    </div>
  )
}
