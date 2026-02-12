'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'

export default function DriverProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [vehicleType, setVehicleType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')

  const loadProfile = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (fetchError) {
        throw fetchError
      }

      if (data) {
        setProfile(data as User)
        setVehicleType(data.vehicle_type || '')
        setVehicleNumber(data.vehicle_number || '')
        setLicenseNumber(data.license_number || '')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      // Используем API route для создания/обновления профиля (обходит RLS)
      const response = await fetch('/api/driver/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicle_type: vehicleType,
          vehicle_number: vehicleNumber,
          license_number: licenseNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка сохранения профиля')
      }

      router.push('/dashboard/driver')
    } catch (err: any) {
      setError(err.message)
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Профиль водителя</h1>

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Тип транспорта *
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
          >
            <option value="">Выберите тип</option>
            <option value="car">Легковой автомобиль</option>
            <option value="motorcycle">Мотоцикл</option>
            <option value="bicycle">Велосипед</option>
            <option value="walking">Пешком</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Номер транспорта
          </label>
          <input
            type="text"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
            placeholder="1234 AB-7"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Номер водительского удостоверения *
          </label>
          <input
            type="text"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
            placeholder="AB1234567"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-900"
          >
            Отмена
          </button>
        </div>
      </form>
      
      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/driver"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/driver/my-orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/driver/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/driver/profile"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">Профиль</span>
          </a>
        </div>
      </div>
    </div>
  )
}
