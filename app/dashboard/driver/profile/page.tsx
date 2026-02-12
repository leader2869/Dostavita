'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'
import { DriverBottomNavigation } from '@/components/driver/DriverBottomNavigation'

export default function DriverProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [organization, setOrganization] = useState<any>(null)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)

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
        setFullName(data.full_name || '')
        setVehicleType(data.vehicle_type || '')
        setVehicleNumber(data.vehicle_number || '')
        setLicenseNumber(data.license_number || '')
        setAvatarUrl(data.avatar_url || null)

        // Если водитель привязан к организации, получаем информацию об организации
        if (data.organization_id) {
          const { data: orgData, error: orgError } = await supabase
            .rpc('get_driver_organization_info', { driver_user_id: user.id })
            .single()
          
          if (!orgError && orgData) {
            setOrganization(orgData)
          }
        }

        // Получаем количество непрочитанных запросов (только pending)
        const { data: requestsData, error: requestsError } = await supabase
          .rpc('get_driver_requests', { driver_user_id: user.id })
        
        if (!requestsError && requestsData) {
          const pendingCount = requestsData.filter((r: any) => r.status === 'pending').length
          setPendingRequestsCount(pendingCount)
        }
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
          full_name: fullName,
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка загрузки аватара')
      }

      const { avatar_url } = await response.json()
      setAvatarUrl(avatar_url)
      if (profile) {
        setProfile({ ...profile, avatar_url })
      }
      alert('Аватар успешно загружен')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Профиль водителя</h1>

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        {/* Аватар */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Аватар"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-600"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-700 border-2 border-gray-600 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
            <label className="absolute bottom-0 right-0 bg-green-600 text-white rounded-full p-2 cursor-pointer hover:bg-green-700 transition">
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
                className="hidden"
              />
            </label>
          </div>
          {uploadingAvatar && (
            <p className="text-sm text-gray-400 mt-2">Загрузка аватара...</p>
          )}
        </div>

        {/* ФИО */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            ФИО
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
            placeholder="Иванов Иван Иванович"
          />
        </div>

        {/* Информация об организации */}
        {organization && (
          <div className="bg-green-900/30 border border-green-500/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-400 mb-2">Организация</h3>
            <p className="text-white font-medium">{organization.organization_name || 'Организация'}</p>
            {organization.organization_email && (
              <p className="text-gray-300 text-sm mt-1">Email: {organization.organization_email}</p>
            )}
            {organization.organization_phone && (
              <p className="text-gray-300 text-sm mt-1">Телефон: {organization.organization_phone}</p>
            )}
          </div>
        )}

        {!organization && profile && !(profile as any).organization_id && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              Вы не привязаны к организации. Ожидайте запросы от организаций в разделе "Запросы".
            </p>
          </div>
        )}

        {/* Тип транспорта */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Тип транспорта *
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
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
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
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
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
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
      
      <DriverBottomNavigation />
    </div>
  )
}
