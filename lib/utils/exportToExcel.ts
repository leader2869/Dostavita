import writeExcelFile, { type SheetData } from 'write-excel-file/browser'
import { toastError } from '@/lib/utils/toast'

type ExportSheet = { sheet: string; data: SheetData }
function toSheetData(rows: Record<string, unknown>[]): SheetData {
  const keys = Array.from(new Set(rows.flatMap(row => Object.keys(row))))
  return [keys, ...rows.map(row => keys.map(key => {
    const value = row[key]
    if (value == null) return null
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'boolean') return value
    // Text remains text, including strings that start with '='.
    return String(value)
  }))]
}
function saveWorkbook(sheets: ExportSheet[], filename: string) {
  if (!sheets.length) return
  void writeExcelFile(sheets).toFile(`${filename}.xlsx`).catch(() => {
    toastError('Не удалось сформировать Excel-файл')
  })
}

/**
 * Экспортирует данные в Excel файл
 * @param data - массив объектов для экспорта
 * @param filename - имя файла (без расширения)
 * @param sheetName - имя листа в Excel
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  filename: string,
  sheetName: string = 'Данные',
  onEmpty?: () => void
) {
  if (!data || data.length === 0) {
    onEmpty ? onEmpty() : alert('Нет данных для экспорта')
    return
  }

  // Создаем рабочую книгу
  const wb: ExportSheet[] = []

  // Преобразуем данные в формат для Excel
  const ws = toSheetData(data)

  // Добавляем лист в книгу
  wb.push({ data: ws, sheet: sheetName })

  // Генерируем файл и скачиваем
  saveWorkbook(wb, filename)
}

/**
 * Экспортирует заказы в Excel
 */
export function exportOrdersToExcel(
  orders: any[],
  filename: string = 'Заказы',
  onEmpty?: () => void
) {
  const formattedOrders = orders.map((order) => ({
    'Номер заказа': order.order_number || order.id.slice(0, 8),
    'Откуда': order.pickup_address || '',
    'Куда': order.delivery_address || '',
    'Статус': order.status || '',
    'Стоимость (BYN)': parseFloat(order.final_price || 0).toFixed(2),
    'Тип товара': order.item_type || '',
    'Описание': order.description || '',
    'Дата создания': order.created_at ? new Date(order.created_at).toLocaleString('ru-RU') : '',
    'Дата завершения': order.completed_at ? new Date(order.completed_at).toLocaleString('ru-RU') : '',
    'Оплачен': order.is_paid ? 'Да' : 'Нет',
    'Кто платит': order.paid_by === 'sender' ? 'Отправитель' : order.paid_by === 'recipient' ? 'Получатель' : '',
    'Готов к выдаче': order.ready_at ? new Date(order.ready_at).toLocaleString('ru-RU') : '',
  }))

  exportToExcel(formattedOrders, filename, 'Заказы', onEmpty)
}

/**
 * Экспортирует транзакции в Excel
 */
export function exportTransactionsToExcel(
  transactions: any[],
  filename: string = 'Транзакции',
  onEmpty?: () => void
) {
  const formattedTransactions = transactions.map((transaction) => ({
    'Дата': transaction.created_at ? new Date(transaction.created_at).toLocaleString('ru-RU') : '',
    'Тип': transaction.type === 'credit' ? 'Начисление' : 'Списание',
    'Сумма (BYN)': parseFloat(transaction.amount || 0).toFixed(2),
    'Описание': transaction.description || '',
    'ID заказа': transaction.order_id || '',
  }))

  exportToExcel(formattedTransactions, filename, 'Транзакции', onEmpty)
}

/**
 * Экспортирует дебиторку в Excel
 */
export function exportReceivablesToExcel(
  receivables: any[],
  filename: string = 'Дебиторка',
  onEmpty?: () => void
) {
  const formattedReceivables = receivables.map((receivable) => ({
    'ID заказа': receivable.order_id || '',
    'Номер заказа': receivable.order_number || '',
    'Должник': receivable.debtor_name || '',
    'Тип должника': receivable.debtor_type === 'sender' ? 'Отправитель' : receivable.debtor_type === 'recipient' ? 'Получатель' : '',
    'Сумма (BYN)': parseFloat(receivable.amount || 0).toFixed(2),
    'Валюта': receivable.currency || 'BYN',
    'Статус': receivable.status === 'unpaid' ? 'Неоплачено' : 'Оплачено',
    'Дата создания': receivable.created_at ? new Date(receivable.created_at).toLocaleString('ru-RU') : '',
  }))

  exportToExcel(formattedReceivables, filename, 'Дебиторка', onEmpty)
}

/**
 * Экспортирует финансовый отчет в Excel (несколько листов)
 */
export function exportFinanceReportToExcel(
  data: {
    orders?: any[]
    transactions?: any[]
    receivables?: any[]
    summary?: Record<string, any>
  },
  filename: string = 'Финансовый отчет'
) {
  const wb: ExportSheet[] = []

  // Сводка
  if (data.summary) {
    const summaryData = Object.entries(data.summary).map(([key, value]) => ({
      'Показатель': key,
      'Значение': typeof value === 'number' ? value.toFixed(2) : String(value),
    }))
    const wsSummary = toSheetData(summaryData)
    wb.push({ data: wsSummary, sheet: 'Сводка' })
  }

  // Заказы
  if (data.orders && data.orders.length > 0) {
    const formattedOrders = data.orders.map((order) => ({
      'Номер заказа': order.order_number || order.id.slice(0, 8),
      'Откуда': order.pickup_address || '',
      'Куда': order.delivery_address || '',
      'Статус': order.status || '',
      'Стоимость (BYN)': parseFloat(order.final_price || 0).toFixed(2),
      'Оплачен': order.is_paid ? 'Да' : 'Нет',
      'Дата завершения': order.completed_at ? new Date(order.completed_at).toLocaleString('ru-RU') : '',
    }))
    const wsOrders = toSheetData(formattedOrders)
    wb.push({ data: wsOrders, sheet: 'Заказы' })
  }

  // Транзакции
  if (data.transactions && data.transactions.length > 0) {
    const formattedTransactions = data.transactions.map((transaction) => ({
      'Дата': transaction.created_at ? new Date(transaction.created_at).toLocaleString('ru-RU') : '',
      'Тип': transaction.type === 'credit' ? 'Начисление' : 'Списание',
      'Сумма (BYN)': parseFloat(transaction.amount || 0).toFixed(2),
      'Описание': transaction.description || '',
    }))
    const wsTransactions = toSheetData(formattedTransactions)
    wb.push({ data: wsTransactions, sheet: 'Транзакции' })
  }

  // Дебиторка
  if (data.receivables && data.receivables.length > 0) {
    const formattedReceivables = data.receivables.map((receivable) => ({
      'ID заказа': receivable.order_id || '',
      'Номер заказа': receivable.order_number || '',
      'Должник': receivable.debtor_name || '',
      'Сумма (BYN)': parseFloat(receivable.amount || 0).toFixed(2),
      'Статус': receivable.status === 'unpaid' ? 'Неоплачено' : 'Оплачено',
      'Дата создания': receivable.created_at ? new Date(receivable.created_at).toLocaleString('ru-RU') : '',
    }))
    const wsReceivables = toSheetData(formattedReceivables)
    wb.push({ data: wsReceivables, sheet: 'Дебиторка' })
  }

  saveWorkbook(wb, filename)
}

