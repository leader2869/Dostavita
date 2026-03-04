'use client'

import { useState, useCallback } from 'react'
import { getDateFilter, type DateFilterPeriod, type DateFilterResult } from '@/lib/utils/dateFilter'

/**
 * Хук для фильтра по периоду на страницах финансов и заказов.
 * Управляет period, customStartDate, customEndDate и возвращает getDateFilter для текущего состояния.
 */
export function useDateFilter(initialPeriod: DateFilterPeriod = 'week') {
  const [period, setPeriod] = useState<DateFilterPeriod>(initialPeriod)
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')

  const getDateFilterForState = useCallback((): DateFilterResult => {
    return getDateFilter(period, customStartDate, customEndDate)
  }, [period, customStartDate, customEndDate])

  return {
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    getDateFilter: getDateFilterForState,
  }
}
