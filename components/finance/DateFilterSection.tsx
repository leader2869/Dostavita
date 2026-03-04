'use client'

import type { DateFilterPeriod } from '@/lib/utils/dateFilter'

interface DateFilterSectionProps {
  period: DateFilterPeriod
  setPeriod: (p: DateFilterPeriod) => void
  customStartDate: string
  setCustomStartDate: (v: string) => void
  customEndDate: string
  setCustomEndDate: (v: string) => void
  onApplyCustom?: () => void
  /** Показывать кнопки «Вчера» и «Произвольная дата». По умолчанию true. */
  showExtended?: boolean
}

export function DateFilterSection({
  period,
  setPeriod,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
  onApplyCustom,
  showExtended = true,
}: DateFilterSectionProps) {
  return (
    <div className="bg-gray-50 rounded-lg shadow p-4 mb-6">
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          type="button"
          onClick={() => setPeriod('today')}
          className={`px-4 py-2 rounded-md transition ${
            period === 'today'
              ? 'bg-brand-light text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
          }`}
        >
          Сегодня
        </button>
        <button
          type="button"
          onClick={() => setPeriod('week')}
          className={`px-4 py-2 rounded-md transition ${
            period === 'week'
              ? 'bg-brand-light text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
          }`}
        >
          Неделя
        </button>
        <button
          type="button"
          onClick={() => setPeriod('month')}
          className={`px-4 py-2 rounded-md transition ${
            period === 'month'
              ? 'bg-brand-light text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
          }`}
        >
          Месяц
        </button>
        <button
          type="button"
          onClick={() => setPeriod('all')}
          className={`px-4 py-2 rounded-md transition ${
            period === 'all'
              ? 'bg-brand-light text-gray-900'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
          }`}
        >
          Все время
        </button>
        {showExtended && (
          <button
            type="button"
            onClick={() => setPeriod('custom')}
            className={`px-4 py-2 rounded-md transition ${
              period === 'custom'
                ? 'bg-brand-light text-gray-900'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-100'
            }`}
          >
            Произвольная дата
          </button>
        )}
      </div>

      {period === 'custom' && (
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата начала</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Дата окончания</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
            />
          </div>
          {onApplyCustom && (
            <button
              type="button"
              onClick={onApplyCustom}
              disabled={!customStartDate || !customEndDate}
              className="px-6 py-2 bg-brand-light text-gray-900 rounded-md hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Применить
            </button>
          )}
        </div>
      )}
    </div>
  )
}
