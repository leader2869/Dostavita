'use client'

import type { Balance } from '@/lib/types'

interface CustomerFinanceBalanceProps {
  balance: Balance | null
}

export function CustomerFinanceBalance({ balance }: CustomerFinanceBalanceProps) {
  return (
    <div className="bg-gray-50 rounded-lg shadow p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900">Баланс организации</h2>
      <p className="text-3xl font-bold text-brand-light">
        {balance?.amount != null ? Number(balance.amount).toFixed(2) : '0.00'} {balance?.currency || 'BYN'}
      </p>
      <p className="text-sm text-gray-600 mt-2">
        Сумма, полученная от водителей (сдача кассы)
      </p>
    </div>
  )
}
