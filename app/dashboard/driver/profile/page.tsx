'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Driver } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'

export default function DriverProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [vehicleType, setVehicleType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')

  const loadDriver = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('drivers')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError
      }

      if (data) {
        setDriver(data)
        setVehicleType(data.vehicle_type)
        setVehicleNumber(data.vehicle_number || '')
        setLicenseNumber(data.license_number)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadDriver()
  }, [loadDriver])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      if (driver) {
        // Обновляем существующий профиль
        const { error: updateError } = await supabase
          .from('drivers')
          .update({
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber,
            license_number: licenseNumber,
          })
          .eq('id', driver.id)

        if (updateError) throw updateError
      } else {
        // Создаем новый профиль
        const { error: insertError } = await supabase
          .from('drivers')
          .insert({
            user_id: user.id,
            vehicle_type: vehicleType,
            vehicle_number: vehicleNumber,
            license_number: licenseNumber,
          })

        if (insertError) throw insertError
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
      <h1 className="text-3xl font-bold mb-6">Профиль водителя</h1>

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
    </div>
  )
}
