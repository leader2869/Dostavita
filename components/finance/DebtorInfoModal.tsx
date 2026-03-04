'use client'

import { useRouter } from 'next/navigation'

interface ReceivableItem {
  id: string
  order_id?: string | null
  order_number?: string | null
  amount?: string | number
  pickup_address?: string | null
  delivery_address?: string | null
  created_at: string
}

interface DebtorInfo {
  organization_name?: string | null
  name?: string | null
  phone?: string | null
  type?: string
}

interface DebtorInfoModalProps {
  debtor: DebtorInfo
  receivables: ReceivableItem[]
  onClose: () => void
}

export function DebtorInfoModal({
  debtor,
  receivables,
  onClose,
}: DebtorInfoModalProps) {
  const router = useRouter()
  const totalAmount = receivables.reduce(
    (sum, r) => sum + (parseFloat(String(r.amount)) || 0),
    0
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Информация о должнике</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          {debtor.organization_name && (
            <div>
              <p className="text-sm text-gray-600">Наименование организации</p>
              <p className="text-gray-900 font-semibold text-lg">{debtor.organization_name}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">ФИО</p>
            <p className="text-gray-900 font-semibold text-lg">{debtor.name || 'Не указано'}</p>
          </div>
          {debtor.phone && (
            <div>
              <p className="text-sm text-gray-600">Телефон</p>
              <p className="text-gray-900">
                <a
                  href={`tel:${debtor.phone}`}
                  className="text-brand-light hover:text-brand-dark font-medium"
                >
                  {debtor.phone}
                </a>
              </p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-600">Тип</p>
            <p className="text-gray-900 capitalize">
              {debtor.type === 'sender' ? 'Отправитель' : 'Получатель'}
            </p>
          </div>
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-600 mb-2">Общая сумма задолженности</p>
            <p className="text-3xl font-bold text-red-400">{totalAmount.toFixed(2)} BYN</p>
            <p className="text-gray-600 text-sm mt-1">
              ({receivables.length}{' '}
              {receivables.length === 1 ? 'неоплаченный заказ' : 'неоплаченных заказов'})
            </p>
          </div>
          {receivables.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Неоплаченные заказы</h3>
              <div className="space-y-2">
                {receivables.map((r) => (
                  <div
                    key={r.id}
                    className="bg-gray-100/50 rounded p-3 cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => {
                      if (r.order_id) router.push(`/dashboard/customer/orders/${r.order_id}`)
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && r.order_id) {
                        router.push(`/dashboard/customer/orders/${r.order_id}`)
                      }
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-gray-900 font-medium">
                          Заказ {r.order_number ? `№${r.order_number}` : 'без номера'}
                        </p>
                        {r.pickup_address && r.delivery_address && (
                          <p className="text-gray-600 text-xs mt-1">
                            {r.pickup_address} → {r.delivery_address}
                          </p>
                        )}
                        <p className="text-gray-600 text-xs mt-1">
                          {new Date(r.created_at).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <p className="text-red-400 font-semibold">
                        {parseFloat(String(r.amount || 0)).toFixed(2)} BYN
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
