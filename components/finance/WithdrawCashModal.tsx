'use client'

import type { OrganizationFinanceRow } from '@/lib/types'

interface WithdrawCashModalProps {
  driver: OrganizationFinanceRow
  amount: string
  onAmountChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
  loading?: boolean
}

export function WithdrawCashModal({
  driver,
  amount,
  onAmountChange,
  onConfirm,
  onClose,
  loading = false,
}: WithdrawCashModalProps) {
  const maxBalance = Number(driver.balance ?? 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-lg shadow-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4 text-gray-900">Забрать кассу у водителя</h2>
        <p className="text-gray-700 mb-2">
          Водитель:{' '}
          <span className="text-gray-900 font-semibold">{driver.driver_full_name || 'Без имени'}</span>
        </p>
        <p className="text-gray-700 mb-4">
          Доступный баланс водителя:{' '}
          <span className="text-brand-light font-semibold">{maxBalance.toFixed(2)} BYN</span>
        </p>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Сумма для изъятия</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={maxBalance}
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 bg-green-300 text-gray-900 px-4 py-2 rounded-md hover:bg-green-400 transition disabled:opacity-50"
          >
            {loading ? 'Отправка…' : 'Забрать кассу'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 bg-gray-600 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-100 transition"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
