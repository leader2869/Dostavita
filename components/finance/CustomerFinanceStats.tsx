'use client'

interface CustomerFinanceStatsProps {
  totalDrivers: number
  totalCompletedOrders: number
  totalEarnings: number
  totalReceivables: number
  onReceivablesClick?: () => void
}

export function CustomerFinanceStats({
  totalDrivers,
  totalCompletedOrders,
  totalEarnings,
  totalReceivables,
  onReceivablesClick,
}: CustomerFinanceStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h3 className="text-sm text-gray-600 mb-2">Водителей</h3>
        <p className="text-3xl font-bold text-gray-900">{totalDrivers}</p>
      </div>
      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h3 className="text-sm text-gray-600 mb-2">Завершенных заказов</h3>
        <p className="text-3xl font-bold text-brand-light">{totalCompletedOrders}</p>
      </div>
      <div className="bg-gray-50 rounded-lg shadow p-6">
        <h3 className="text-sm text-gray-600 mb-2">Общая сумма</h3>
        <p className="text-3xl font-bold text-blue-400">{totalEarnings.toFixed(2)} BYN</p>
      </div>
      <div
        role={onReceivablesClick ? 'button' : undefined}
        className={`bg-gray-50 rounded-lg shadow p-6 ${onReceivablesClick ? 'cursor-pointer hover:bg-gray-100 transition' : ''}`}
        onClick={onReceivablesClick}
      >
        <h3 className="text-sm text-gray-600 mb-2">Дебиторка</h3>
        <p className="text-3xl font-bold text-red-400">{totalReceivables.toFixed(2)} BYN</p>
      </div>
    </div>
  )
}
