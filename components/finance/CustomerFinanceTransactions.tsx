'use client'

interface TransactionRow {
  id: string
  description?: string | null
  type?: string
  amount: string | number
  created_at: string
  profiles?: { full_name?: string } | null
}

interface CustomerFinanceTransactionsProps {
  transactions: TransactionRow[]
  period: string
  onExport: () => void
}

export function CustomerFinanceTransactions({
  transactions,
  period,
  onExport,
}: CustomerFinanceTransactionsProps) {
  return (
    <div className="bg-gray-50 rounded-lg shadow p-6 mt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900">История транзакций</h2>
        <button
          type="button"
          onClick={onExport}
          className="bg-brand-light hover:bg-brand-dark text-white px-3 py-1.5 rounded text-xs font-medium transition flex items-center gap-1"
          title="Экспорт транзакций в Excel"
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
      {transactions && transactions.length > 0 ? (
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="border-b border-gray-200 pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium text-gray-900">
                    {transaction.description}
                    {transaction.profiles && (
                      <span className="text-sm text-gray-600 ml-2">
                        ({transaction.profiles.full_name || 'Водитель'})
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(transaction.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>
                <p
                  className={`font-semibold ${
                    transaction.type === 'credit' ? 'text-green-600' : 'text-red-400'
                  }`}
                >
                  {transaction.type === 'credit' ? '+' : '-'}
                  {transaction.amount} BYN
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">Нет транзакций</p>
      )}
    </div>
  )
}
