/**
 * Общая логика фильтра по периоду для страниц финансов и заказов.
 */
export type DateFilterPeriod =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'month'
  | 'all'
  | 'custom'

export interface DateFilterResult {
  start: string | null
  end: string | null
}

/**
 * Возвращает start/end в ISO для выбранного периода.
 * Для 'all' и части периодов end может быть null (означает «до текущего момента»).
 */
export function getDateFilter(
  period: DateFilterPeriod,
  customStartDate?: string,
  customEndDate?: string
): DateFilterResult {
  const now = new Date()

  switch (period) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'yesterday': {
      const yesterday = new Date(now)
      yesterday.setDate(now.getDate() - 1)
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0)
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)
      return { start: start.toISOString(), end: end.toISOString() }
    }
    case 'week': {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - 7)
      weekStart.setHours(0, 0, 0, 0)
      const weekEnd = new Date(now)
      weekEnd.setHours(23, 59, 59, 999)
      return { start: weekStart.toISOString(), end: weekEnd.toISOString() }
    }
    case 'month': {
      const monthStart = new Date(now)
      monthStart.setMonth(now.getMonth() - 1)
      monthStart.setHours(0, 0, 0, 0)
      const monthEnd = new Date(now)
      monthEnd.setHours(23, 59, 59, 999)
      return { start: monthStart.toISOString(), end: monthEnd.toISOString() }
    }
    case 'custom':
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(customEndDate)
        end.setHours(23, 59, 59, 999)
        return { start: start.toISOString(), end: end.toISOString() }
      }
      return { start: null, end: null }
    case 'all':
    default:
      return { start: null, end: null }
  }
}
