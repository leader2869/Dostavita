'use client'

import { exportOrdersToExcel } from '@/lib/utils/exportToExcel'
import { toastError } from '@/lib/utils/toast'

interface ExportOrdersButtonProps {
  orders: unknown[]
  /** Имя файла. Если не задано, используется defaultFilenamePrefix + дата */
  filename?: string
  /** Префикс имени файла по умолчанию (дата подставится автоматически) */
  defaultFilenamePrefix?: string
}

const DEFAULT_PREFIX = 'Заказы_'

export function ExportOrdersButton({
  orders,
  filename,
  defaultFilenamePrefix = DEFAULT_PREFIX,
}: ExportOrdersButtonProps) {
  const handleExport = () => {
    const date = new Date().toISOString().split('T')[0]
    const exportFilename = filename ?? `${defaultFilenamePrefix}${date}`
    exportOrdersToExcel(orders, exportFilename, () => toastError('Нет данных для экспорта'))
  }

  return (
    <button
      onClick={handleExport}
      className="bg-brand-light hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
      title="Экспорт заказов в Excel"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Экспорт в Excel
    </button>
  )
}
