'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'
import { BackButton } from '@/components/ui/BackButton'

interface DeliverySetting {
  id: string
  setting_key: string
  setting_value: number
  description: string | null
}

export default function DeliverySettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useDashboardUser()
  const [settings, setSettings] = useState<DeliverySetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const isSuperadmin = profile.role === 'superadmin'

  useEffect(() => {
    if (profile.role !== 'superadmin') router.push('/dashboard')
  }, [profile.role, router])

  const loadSettings = useCallback(async () => {
    try {
      // Пробуем использовать RPC функцию
      let { data, error } = await supabase
        .rpc('get_delivery_settings')

      // Fallback на прямой запрос
      if (error || !data) {
        const result = await supabase
          .from('delivery_settings')
          .select('*')
          .order('setting_key')
        
        data = result.data
        error = result.error
      }

      if (error) throw error
      setSettings(data || [])
    } catch (err: any) {
      console.error('Ошибка загрузки настроек:', err)
      setError(err.message || 'Ошибка загрузки настроек')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    if (profile.role === 'superadmin') loadSettings()
  }, [profile.role, loadSettings])

  const handleSave = async (setting: DeliverySetting, newValue: number) => {
    if (newValue < 1) {
      setError('Значение должно быть больше 0')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const { error } = await supabase
        .from('delivery_settings')
        .update({ setting_value: newValue })
        .eq('id', setting.id)

      if (error) throw error

      // Обновляем локальное состояние
      setSettings(settings.map(s => 
        s.id === setting.id ? { ...s, setting_value: newValue } : s
      ))

      setSuccess('Настройки успешно сохранены')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      console.error('Ошибка сохранения настроек:', err)
      setError(err.message || 'Ошибка сохранения настроек')
    } finally {
      setSaving(false)
    }
  }

  const getSettingLabel = (key: string) => {
    switch (key) {
      case 'max_searching_courier_minutes':
        return 'Максимальное время поиска курьера'
      case 'max_courier_coming_minutes':
        return 'Максимальное время до прибытия курьера'
      case 'max_courier_delivering_minutes':
        return 'Максимальное время доставки заказа'
      default:
        return key
    }
  }

  if (loading || !isSuperadmin) {
    return (
      <div>
        <BackButton />
        <div className="text-center py-8 text-gray-600">Загрузка...</div>
      </div>
    )
  }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Настройки доставки</h1>

      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded border border-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 text-brand-light text-sm bg-green-900 bg-opacity-30 p-3 rounded border border-green-800">
          {success}
        </div>
      )}

      <div className="bg-gray-50 rounded-lg shadow p-6 space-y-6">
        {settings.map((setting) => (
          <div key={setting.id} className="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  {getSettingLabel(setting.setting_key)}
                </h3>
                {setting.description && (
                  <p className="text-sm text-gray-600">{setting.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4 ml-6">
                <input
                  type="number"
                  min="1"
                  defaultValue={setting.setting_value}
                  onBlur={(e) => {
                    const newValue = parseInt(e.target.value)
                    if (!isNaN(newValue) && newValue !== setting.setting_value) {
                      handleSave(setting, newValue)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newValue = parseInt((e.target as HTMLInputElement).value)
                      if (!isNaN(newValue) && newValue !== setting.setting_value) {
                        handleSave(setting, newValue)
                      }
                    }
                  }}
                  className="w-24 px-3 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-light focus:border-brand-light"
                />
                <span className="text-gray-600">минут</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-gray-50 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900">Как это работает</h2>
        <ul className="space-y-2 text-gray-700">
          <li>• Заказы, у которых время превышает установленный лимит, будут отображаться красным цветом</li>
          <li>• Это помогает быстро находить заказы, требующие внимания</li>
          <li>• Изменения применяются сразу после сохранения</li>
        </ul>
      </div>
    </div>
  )
}

