'use client'

import { useState, useEffect, useCallback, type ComponentProps } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import {
  exportFinanceReportToExcel,
  exportReceivablesToExcel,
  exportTransactionsToExcel,
} from '@/lib/utils/exportToExcel'
import type { Balance, OrganizationFinanceRow } from '@/lib/types'
import { useDateFilter } from '@/hooks/useDateFilter'
import { fetchOrCreateBalance } from '@/lib/utils/balance'
import { toastError, toastSuccess } from '@/lib/utils/toast'
import { DateFilterSection } from '@/components/finance/DateFilterSection'
import { CustomerFinanceBalance } from '@/components/finance/CustomerFinanceBalance'
import { CashDepositRequestsSection } from '@/components/finance/CashDepositRequestsSection'
import { CustomerFinanceStats } from '@/components/finance/CustomerFinanceStats'
import { CustomerFinanceDrivers } from '@/components/finance/CustomerFinanceDrivers'
import { WithdrawCashModal } from '@/components/finance/WithdrawCashModal'
import { CustomerReceivablesSection } from '@/components/finance/CustomerReceivablesSection'
import { DebtorInfoModal } from '@/components/finance/DebtorInfoModal'
import { CustomerFinanceTransactions } from '@/components/finance/CustomerFinanceTransactions'

export default function CustomerFinancePage() {
  const router = useRouter()
  const supabase = createClient()
  const {
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    getDateFilter,
  } = useDateFilter('week')

  const [user, setUser] = useState<{ id: string } | null>(null)
  const [balance, setBalance] = useState<Balance | null>(null)
  const [finances, setFinances] = useState<OrganizationFinanceRow[]>([])
  const [receivables, setReceivables] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<OrganizationFinanceRow | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [cashDepositRequests, setCashDepositRequests] = useState<Record<string, unknown>[]>([])
  const [showDebtorModal, setShowDebtorModal] = useState(false)
  const [selectedDebtor, setSelectedDebtor] = useState<{
    organization_name?: string
    name?: string
    phone?: string
    type?: string
  } | null>(null)
  const [debtorReceivables, setDebtorReceivables] = useState<Record<string, unknown>[]>([])
  const [transactions, setTransactions] = useState<Record<string, unknown>[]>([])
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set())

  const loadData = useCallback(async () => {
    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()
      if (!currentUser) {
        router.push('/login')
        return
      }
      setUser(currentUser)
      const balanceData = await fetchOrCreateBalance(supabase, currentUser.id)
      setBalance(balanceData)
      const dateFilter = getDateFilter()

      const { data: financesData, error: financesError } = await supabase.rpc(
        'get_organization_finances',
        {
          organization_user_id: currentUser.id,
          start_date: dateFilter.start,
          end_date: dateFilter.end,
        }
      )
      if (financesError) {
        console.error('Ошибка загрузки финансов:', financesError)
      } else {
        setFinances(financesData || [])
      }

      const { data: receivablesData, error: receivablesError } = await supabase.rpc(
        'get_organization_receivables',
        {
          organization_user_id: currentUser.id,
          start_date: dateFilter.start,
          end_date: dateFilter.end,
        }
      )
      if (receivablesError) {
        console.error('Ошибка загрузки дебиторки:', receivablesError)
        setReceivables([])
      } else {
        setReceivables(receivablesData || [])
      }

      const { data: requestsData, error: requestsError } = await supabase
        .from('cash_deposit_requests')
        .select(
          `*,
          profiles!cash_deposit_requests_driver_user_id_fkey(full_name)`
        )
        .eq('organization_id', currentUser.id)
        .order('created_at', { ascending: false })
      if (requestsError) {
        console.error('Ошибка загрузки запросов на сдачу кассы:', requestsError)
      }
      setCashDepositRequests(requestsData || [])

      const transactionsDateFilter = getDateFilter()
      let transactionsQuery = supabase
        .from('transactions')
        .select('*, profiles!transactions_user_id_fkey(id, full_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (transactionsDateFilter.start) {
        transactionsQuery = transactionsQuery.gte(
          'created_at',
          transactionsDateFilter.start
        )
      }
      if (transactionsDateFilter.end) {
        transactionsQuery = transactionsQuery.lte(
          'created_at',
          transactionsDateFilter.end
        )
      }
      const { data: transactionsData, error: transactionsError } =
        await transactionsQuery
      if (transactionsError) {
        console.error('Ошибка загрузки транзакций:', transactionsError)
      } else {
        setTransactions(transactionsData || [])
      }
    } catch (err: unknown) {
      console.error('Ошибка загрузки данных:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, period, customStartDate, customEndDate, getDateFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalDrivers = finances.length
  const totalCompletedOrders = finances.reduce(
    (sum, f) => sum + (parseInt(String(f.completed_orders_count)) || 0),
    0
  )
  const totalEarnings = finances.reduce(
    (sum, f) => sum + (parseFloat(String(f.total_earnings)) || 0),
    0
  )
  const totalReceivables = receivables.reduce(
    (sum, r) => sum + (parseFloat(String(r.amount)) || 0),
    0
  )

  const groupedByDebtor = receivables.reduce(
    (acc: Record<string, {
      debtor_user_id: string
      debtor_name: string
      debtor_organization_name: string | null
      debtor_phone: string | null
      receivables: Record<string, unknown>[]
      totalAmount: number
      ordersCount: number
    }>,
    receivable: Record<string, unknown>
  ) => {
    const debtorId = String(receivable.debtor_user_id ?? 'unknown')
    if (!acc[debtorId]) {
      acc[debtorId] = {
        debtor_user_id: debtorId,
        debtor_name: String(receivable.debtor_name ?? 'Неизвестно'),
        debtor_organization_name: (receivable.debtor_organization_name as string) ?? null,
        debtor_phone: (receivable.debtor_phone as string) ?? null,
        receivables: [],
        totalAmount: 0,
        ordersCount: 0,
      }
    }
    acc[debtorId].receivables.push(receivable)
    acc[debtorId].totalAmount += parseFloat(String(receivable.amount ?? 0))
    acc[debtorId].ordersCount += 1
    return acc
  },
  {}
  )
  const debtorsList = Object.values(groupedByDebtor) as unknown as ComponentProps<
    typeof CustomerReceivablesSection
  >['debtorsList']

  const toggleDebtor = useCallback((debtorId: string) => {
    setExpandedDebtors((prev) => {
      const next = new Set(prev)
      if (next.has(debtorId)) next.delete(debtorId)
      else next.add(debtorId)
      return next
    })
  }, [])

  const periodLabel =
    period === 'all'
      ? 'Все время'
      : period === 'today'
        ? 'Сегодня'
        : period === 'week'
          ? 'Неделя'
          : period === 'month'
            ? 'Месяц'
            : 'Выбранный период'

  const handleExportAll = useCallback(() => {
    const filename = `Финансовый_отчет_организации_${period}_${new Date().toISOString().split('T')[0]}`
    exportFinanceReportToExcel(
      {
        receivables,
        summary: {
          'Баланс организации':
            balance?.amount != null
              ? `${Number(balance.amount).toFixed(2)} BYN`
              : '0.00 BYN',
          'Общая дебиторка': `${totalReceivables.toFixed(2)} BYN`,
          'Количество неоплаченных заказов': String(receivables.length),
          'Количество водителей': String(totalDrivers),
          'Завершенных заказов': String(totalCompletedOrders),
          'Общая сумма заказов': `${totalEarnings.toFixed(2)} BYN`,
          'Период': periodLabel,
        },
      },
      filename
    )
  }, [balance, period, periodLabel, receivables, totalCompletedOrders, totalDrivers, totalEarnings, totalReceivables])

  const handleWithdrawConfirm = useCallback(async () => {
    if (!selectedDriver || !user) return
    const amount = parseFloat(withdrawAmount)
    if (!amount || amount <= 0) {
      toastError('Введите корректную сумму')
      return
    }
    if (amount > parseFloat(String(selectedDriver.balance ?? 0))) {
      toastError('Недостаточно средств на балансе водителя')
      return
    }
    setWithdrawLoading(true)
    try {
      const { data, error } = await supabase.rpc('withdraw_cash_from_driver', {
        organization_user_id: user.id,
        driver_user_id: selectedDriver.driver_id,
        amount_to_withdraw: amount,
      })
      if (error) {
        console.error('Ошибка изъятия кассы:', error)
        toastError(error.message)
      } else if (data === false) {
        toastError(
          'Не удалось забрать кассу. Проверьте, что водитель привязан к вашей организации.'
        )
      } else {
        toastSuccess('Касса успешно изъята!')
        setShowWithdrawModal(false)
        setSelectedDriver(null)
        setWithdrawAmount('')
        setTimeout(loadData, 2000)
      }
    } catch (err: unknown) {
      console.error('Ошибка изъятия кассы:', err)
      toastError(err instanceof Error ? err.message : 'Не удалось забрать кассу')
    } finally {
      setWithdrawLoading(false)
    }
  }, [selectedDriver, user, withdrawAmount, supabase, loadData])

  const scrollToReceivables = useCallback(() => {
    document.getElementById('receivables-section')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <div className="flex justify-between items-center mb-6">
        <button
          type="button"
          onClick={handleExportAll}
          className="bg-brand-light hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2"
          title="Экспорт всех данных в Excel"
        >
          <svg
            className="w-5 h-5"
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
          Экспорт в Excel
        </button>
      </div>

      <DateFilterSection
        period={period}
        setPeriod={setPeriod}
        customStartDate={customStartDate}
        setCustomStartDate={setCustomStartDate}
        customEndDate={customEndDate}
        setCustomEndDate={setCustomEndDate}
        onApplyCustom={
          customStartDate && customEndDate ? loadData : undefined
        }
        showExtended
      />

      <CustomerFinanceBalance balance={balance} />

      <CashDepositRequestsSection
        requests={cashDepositRequests as unknown as ComponentProps<typeof CashDepositRequestsSection>['requests']}
        supabase={supabase}
        onSuccess={loadData}
      />

      <CustomerFinanceStats
        totalDrivers={totalDrivers}
        totalCompletedOrders={totalCompletedOrders}
        totalEarnings={totalEarnings}
        totalReceivables={totalReceivables}
        onReceivablesClick={scrollToReceivables}
      />

      <CustomerFinanceDrivers
        finances={finances}
        receivables={receivables}
        onWithdraw={(driver) => {
          setSelectedDriver(driver)
          setWithdrawAmount('')
          setShowWithdrawModal(true)
        }}
      />

      {showWithdrawModal && selectedDriver && (
        <WithdrawCashModal
          driver={selectedDriver}
          amount={withdrawAmount}
          onAmountChange={setWithdrawAmount}
          onConfirm={handleWithdrawConfirm}
          onClose={() => {
            setShowWithdrawModal(false)
            setSelectedDriver(null)
            setWithdrawAmount('')
          }}
          loading={withdrawLoading}
        />
      )}

      <CustomerReceivablesSection
        debtorsList={debtorsList}
        expandedDebtors={expandedDebtors}
        toggleDebtor={toggleDebtor}
        supabase={supabase}
        onSuccess={loadData}
        onExport={() => {
          const filename = `Дебиторка_${new Date().toISOString().split('T')[0]}`
          exportReceivablesToExcel(receivables, filename, () =>
            toastError('Нет данных для экспорта')
          )
        }}
      />

      {showDebtorModal && selectedDebtor && (
        <DebtorInfoModal
          debtor={selectedDebtor}
          receivables={debtorReceivables as unknown as ComponentProps<typeof DebtorInfoModal>['receivables']}
          onClose={() => {
            setShowDebtorModal(false)
            setSelectedDebtor(null)
            setDebtorReceivables([])
          }}
        />
      )}

      <CustomerFinanceTransactions
        transactions={transactions as unknown as ComponentProps<typeof CustomerFinanceTransactions>['transactions']}
        period={period}
        onExport={() => {
          const filename = `Транзакции_${period}_${new Date().toISOString().split('T')[0]}`
          exportTransactionsToExcel(transactions, filename, () =>
            toastError('Нет данных для экспорта')
          )
        }}
      />
    </div>
  )
}
