'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@/lib/types'

export default function DriverProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [organization, setOrganization] = useState<any>(null)
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0)
  const [requests, setRequests] = useState<any[]>([])
  const [responding, setResponding] = useState<string | null>(null)

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
        setPhone(data.phone || '')
        setVehicleType(data.vehicle_type || '')
        setVehicleBrand(data.vehicle_brand || '')
        setVehicleModel(data.vehicle_model || '')
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

        // Получаем запросы на присоединение к организации
        const { data: requestsData, error: requestsError } = await supabase
          .rpc('get_driver_requests', { driver_user_id: user.id })
        
        if (!requestsError && requestsData) {
          setRequests(requestsData || [])
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
          // Телефон не отправляем - его можно изменить только через админа
          vehicle_type: vehicleType,
          vehicle_brand: vehicleBrand,
          vehicle_model: vehicleModel,
          vehicle_number: vehicleNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка сохранения профиля')
      }

      // Перезагружаем профиль для обновления данных
      await loadProfile()
      
      // Показываем сообщение об успешном сохранении
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
      }, 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
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

  const handleRespondToRequest = async (requestId: string, response: 'accepted' | 'rejected') => {
    if (!confirm(response === 'accepted' 
      ? 'Вы уверены, что хотите принять запрос и привязаться к этой организации?'
      : 'Вы уверены, что хотите отклонить запрос?')) {
      return
    }

    setResponding(requestId)
    setError(null)

    try {
      const fetchResponse = await fetch(`/api/driver/requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ response }),
      })

      const data = await fetchResponse.json()

      if (!fetchResponse.ok) {
        throw new Error(data.error || 'Ошибка обработки запроса')
      }

      alert(data.message)
      await loadProfile() // Обновляем профиль и запросы
    } catch (err: any) {
      setError(err.message)
    } finally {
      setResponding(null)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Загрузка...</div>
  }

  return (
    <div className="max-w-2xl mx-auto pb-20">

      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg shadow p-6 space-y-4">
        {/* Аватар */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Аватар"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-600"
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
            <label className="absolute bottom-0 right-0 bg-brand-light text-gray-900 rounded-full p-2 cursor-pointer hover:bg-brand-dark transition">
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
            <p className="text-sm text-gray-600 mt-2">Загрузка аватара...</p>
          )}
        </div>

        {/* ФИО */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ФИО
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
            placeholder="Иванов Иван Иванович"
          />
        </div>

        {/* Телефон */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Телефон
          </label>
          <input
            type="tel"
            value={phone}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-600"
            placeholder="+375 (XX) XXX-XX-XX"
          />
          <p className="text-xs text-gray-600 mt-1">Телефон нельзя изменить. Для изменения обратитесь к администратору.</p>
        </div>

        {/* Информация об организации */}
        {organization && (
          <div className="bg-blue-50/30 border border-blue-200/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Привязанная организация</h3>
            <p className="text-gray-900 font-medium">{organization.organization_name || 'Организация'}</p>
            {organization.organization_email && (
              <p className="text-gray-700 text-sm mt-1">Email: {organization.organization_email}</p>
            )}
            {organization.organization_phone && (
              <p className="text-gray-700 text-sm mt-1">Телефон: {organization.organization_phone}</p>
            )}
          </div>
        )}

        {!organization && profile && !(profile as any).organization_id && (
          <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              Вы не привязаны к организации. Ниже вы можете увидеть запросы от организаций.
            </p>
          </div>
        )}

        {/* Тип транспорта */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Тип транспорта *
          </label>
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
          >
            <option value="">Выберите тип</option>
            <option value="car">Легковой автомобиль</option>
            <option value="motorcycle">Мотоцикл</option>
            <option value="bicycle">Велосипед</option>
            <option value="walking">Пешком</option>
          </select>
        </div>

        {(vehicleType === 'car' || vehicleType === 'motorcycle') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Марка и модель транспорта
            </label>
            <input
              type="text"
              value={`${vehicleBrand}${vehicleBrand && vehicleModel ? ' ' : ''}${vehicleModel}`.trim()}
              onChange={(e) => {
                const value = e.target.value.trim()
                // Разделяем: первое слово - марка, остальное - модель
                const parts = value.split(/\s+/)
                if (parts.length > 0 && parts[0]) {
                  setVehicleBrand(parts[0])
                  setVehicleModel(parts.slice(1).join(' '))
                } else {
                  setVehicleBrand('')
                  setVehicleModel('')
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
              placeholder="Toyota Camry, BMW X5, Honda CBR600"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Номер транспорта
          </label>
          <input
            type="text"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-900"
            placeholder="1234 AB-7"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-green-500 text-white px-6 py-2 rounded-md hover:bg-green-600 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : saved ? 'Изменения сохранены' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md hover:bg-white"
          >
            Отмена
          </button>
        </div>
      </form>

      {/* Запросы на присоединение к организации */}
      {requests && requests.length > 0 && (
        <div className="bg-gray-50 rounded-lg shadow p-6 mt-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900">
            Запросы на присоединение к организации
            {pendingRequestsCount > 0 && (
              <span className="ml-2 bg-red-500 text-gray-900 text-xs font-bold rounded-full px-2 py-1">
                {pendingRequestsCount}
              </span>
            )}
          </h2>
          <div className="space-y-4">
            {requests.map((request: any) => (
              <div
                key={request.id}
                className={`border rounded-lg p-4 ${
                  request.status === 'pending'
                    ? 'border-yellow-500/50 bg-yellow-900/20'
                    : request.status === 'accepted'
                    ? 'border-green-500/50 bg-green-900/20'
                    : 'border-gray-200 bg-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {request.organization_name || 'Организация'}
                    </p>
                    <p className="text-sm text-gray-600">{request.organization_email}</p>
                    {request.message && (
                      <p className="text-sm text-gray-700 mt-2">{request.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Получен: {new Date(request.created_at).toLocaleString('ru-RU')}
                    </p>
                    {request.status === 'pending' && (
                      <p className="text-xs text-yellow-400 mt-1">Ожидает вашего ответа</p>
                    )}
                    {request.status === 'accepted' && (
                      <p className="text-xs text-brand-light mt-1">Принят</p>
                    )}
                    {request.status === 'rejected' && (
                      <p className="text-xs text-red-400 mt-1">Отклонен</p>
                    )}
                  </div>
                  {request.status === 'pending' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleRespondToRequest(request.id, 'accepted')}
                        disabled={responding === request.id}
                        className="bg-brand-light text-gray-900 px-4 py-2 rounded text-sm hover:bg-brand-dark disabled:opacity-50 transition"
                      >
                        {responding === request.id ? 'Обработка...' : 'Принять'}
                      </button>
                      <button
                        onClick={() => handleRespondToRequest(request.id, 'rejected')}
                        disabled={responding === request.id}
                        className="bg-red-600 text-gray-900 px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        {responding === request.id ? 'Обработка...' : 'Отклонить'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {requests && requests.length === 0 && !organization && (
        <div className="bg-gray-50 rounded-lg shadow p-6 mt-6">
          <p className="text-gray-600 text-center">
            У вас пока нет запросов от организаций
          </p>
        </div>
      )}
    </div>
  )
}
