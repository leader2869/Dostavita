'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'

export default function CustomerDriversPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [user, setUser] = useState<any>(null)
  const [drivers, setDrivers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [attaching, setAttaching] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Форма создания водителя
  const [newDriverEmail, setNewDriverEmail] = useState('')
  const [newDriverPassword, setNewDriverPassword] = useState('')
  const [newDriverFullName, setNewDriverFullName] = useState('')
  const [newDriverPhone, setNewDriverPhone] = useState('')
  const [newDriverVehicleType, setNewDriverVehicleType] = useState('')
  const [newDriverVehicleBrand, setNewDriverVehicleBrand] = useState('')
  const [newDriverVehicleModel, setNewDriverVehicleModel] = useState('')
  const [newDriverVehicleNumber, setNewDriverVehicleNumber] = useState('')
  const [newDriverLicenseNumber, setNewDriverLicenseNumber] = useState('')

  const loadDrivers = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push('/login')
        return
      }

      setUser(currentUser)

      // Проверяем роль
      const { data: profile } = await supabase
        .rpc('get_user_profile', { user_id: currentUser.id })
        .single()

      if (!profile || (profile as any).role !== 'customer') {
        router.push('/dashboard')
        return
      }

      // Получаем водителей организации
      const { data: driversData, error: driversError } = await supabase
        .rpc('get_organization_drivers', { organization_user_id: currentUser.id })

      if (driversError) {
        console.error('Ошибка загрузки водителей:', driversError)
        setDrivers([])
      } else {
        setDrivers(driversData || [])
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      setDrivers([])
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

  useEffect(() => {
    loadDrivers()
  }, [loadDrivers])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setSearching(true)
    setError(null)

    try {
      const response = await fetch('/api/customer/search-drivers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ search: searchQuery }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка поиска')
      }

      setSearchResults(data.drivers || [])
    } catch (err: any) {
      setError(err.message)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleAttachDriver = async (driverId: string, message?: string) => {
    setAttaching(driverId)
    setError(null)

    try {
      const response = await fetch('/api/customer/attach-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driver_user_id: driverId, message }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отправки запроса')
      }

      // Обновляем список водителей
      await loadDrivers()
      setShowAddModal(false)
      setSearchQuery('')
      setSearchResults([])
      alert('Запрос на привязку водителя успешно отправлен. Водитель получит уведомление.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setAttaching(null)
    }
  }

  const handleCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/customer/create-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newDriverEmail,
          password: newDriverPassword,
          full_name: newDriverFullName,
          phone: newDriverPhone,
          vehicle_type: newDriverVehicleType,
          vehicle_brand: newDriverVehicleBrand,
          vehicle_model: newDriverVehicleModel,
          vehicle_number: newDriverVehicleNumber,
          license_number: newDriverLicenseNumber,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.requires_manual_registration) {
          alert('Создание пользователей через API недоступно. Попросите водителя зарегистрироваться самостоятельно, а затем отправьте ему запрос на привязку.')
        }
        throw new Error(data.error || 'Ошибка создания водителя')
      }

      // Обновляем список водителей
      await loadDrivers()
      setShowCreateModal(false)
      // Очищаем форму
      setNewDriverEmail('')
      setNewDriverPassword('')
      setNewDriverFullName('')
      setNewDriverPhone('')
      setNewDriverVehicleType('')
      setNewDriverVehicleBrand('')
      setNewDriverVehicleModel('')
      setNewDriverVehicleNumber('')
      setNewDriverLicenseNumber('')
      alert('Аккаунт водителя успешно создан и привязан к организации')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleDetachDriver = async (driverId: string) => {
    if (!confirm('Вы уверены, что хотите отвязать этого водителя от организации?')) {
      return
    }

    setError(null)

    try {
      const response = await fetch('/api/customer/detach-driver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ driver_user_id: driverId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка отвязки водителя')
      }

      // Обновляем список водителей
      await loadDrivers()
      alert('Водитель успешно отвязан от организации')
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <h1 className="text-3xl font-bold mb-6 text-white">Управление водителями</h1>
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Управление водителями</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Мои водители ({drivers.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            >
              Создать водителя
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition"
            >
              Найти водителя
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        {drivers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {drivers.map((driver: any) => (
              <div key={driver.id} className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition">
                <div className="flex items-center gap-3 mb-3">
                  {driver.avatar_url ? (
                    <img
                      src={driver.avatar_url}
                      alt={driver.full_name || 'Водитель'}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-600 flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-white">{driver.full_name || 'Без имени'}</p>
                    <p className="text-sm text-gray-400">{driver.email}</p>
                    <p className="text-sm text-gray-400">{driver.phone || 'Телефон не указан'}</p>
                  </div>
                </div>
                <div className="space-y-1 text-sm mb-3">
                  <p className="text-gray-300">
                    <span className="text-gray-400">Транспорт:</span> {
                      driver.vehicle_type === 'car' ? 'Автомобиль' :
                      driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                      driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                      driver.vehicle_type === 'walking' ? 'Пешком' : driver.vehicle_type || 'Не указан'
                    }
                    {driver.vehicle_brand && driver.vehicle_model && (
                      <span className="ml-1">({driver.vehicle_brand} {driver.vehicle_model})</span>
                    )}
                  </p>
                  {driver.vehicle_number && (
                    <p className="text-gray-300">
                      <span className="text-gray-400">Номер:</span> {driver.vehicle_number}
                    </p>
                  )}
                  {driver.license_number && (
                    <p className="text-gray-300">
                      <span className="text-gray-400">Удостоверение:</span> {driver.license_number}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <a
                    href={`/dashboard/customer/drivers/${driver.id}`}
                    className="flex-1 text-center bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
                  >
                    Подробнее
                  </a>
                  <a
                    href={`/dashboard/customer/tracking?driver=${driver.id}`}
                    className="flex-1 text-center bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition"
                  >
                    Отследить
                  </a>
                  <button
                    onClick={() => handleDetachDriver(driver.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition"
                    title="Отвязать водителя"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">У вас пока нет водителей</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 transition"
            >
              Добавить первого водителя
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно для добавления водителя */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Добавить водителя</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    setSearchQuery('')
                    setSearchResults([])
                    setError(null)
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Поиск водителя (email, имя, телефон)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Введите email, имя или телефон..."
                    className="flex-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400"
                  />
                  <button
                    onClick={handleSearch}
                    disabled={searching}
                    className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {searching ? 'Поиск...' : 'Найти'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Найдено водителей: {searchResults.length}
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {searchResults.map((driver: any) => (
                      <div
                        key={driver.id}
                        className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="font-medium text-white">{driver.full_name || 'Без имени'}</p>
                            <p className="text-sm text-gray-400">{driver.email}</p>
                            {driver.phone && (
                              <p className="text-sm text-gray-400">{driver.phone}</p>
                            )}
                            {driver.vehicle_type && (
                              <p className="text-xs text-gray-500 mt-1">
                                Транспорт: {
                                  driver.vehicle_type === 'car' ? 'Автомобиль' :
                                  driver.vehicle_type === 'motorcycle' ? 'Мотоцикл' :
                                  driver.vehicle_type === 'bicycle' ? 'Велосипед' :
                                  driver.vehicle_type === 'walking' ? 'Пешком' : driver.vehicle_type
                                }
                                {driver.vehicle_brand && driver.vehicle_model && (
                                  <span className="ml-1">({driver.vehicle_brand} {driver.vehicle_model})</span>
                                )}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const message = prompt('Введите сообщение для водителя (необязательно):')
                              handleAttachDriver(driver.id, message || undefined)
                            }}
                            disabled={attaching === driver.id}
                            className="ml-4 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50 transition"
                          >
                            {attaching === driver.id ? 'Отправка...' : 'Отправить запрос'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {searchQuery && !searching && searchResults.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  Водители не найдены. Попробуйте другой поисковый запрос.
                </div>
              )}

              {!searchQuery && searchResults.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  Введите данные для поиска водителя (email, имя или телефон)
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для создания водителя */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Создать аккаунт водителя</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setError(null)
                    setNewDriverEmail('')
                    setNewDriverPassword('')
                    setNewDriverFullName('')
                    setNewDriverPhone('')
                    setNewDriverVehicleType('')
                    setNewDriverVehicleBrand('')
                    setNewDriverVehicleModel('')
                    setNewDriverVehicleNumber('')
                    setNewDriverLicenseNumber('')
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleCreateDriver} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newDriverEmail}
                    onChange={(e) => setNewDriverEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                    placeholder="driver@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Пароль *
                  </label>
                  <input
                    type="password"
                    value={newDriverPassword}
                    onChange={(e) => setNewDriverPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                    placeholder="Минимум 6 символов"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Полное имя *
                  </label>
                  <input
                    type="text"
                    value={newDriverFullName}
                    onChange={(e) => setNewDriverFullName(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                    placeholder="Иванов Иван Иванович"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Телефон
                  </label>
                  <input
                    type="tel"
                    value={newDriverPhone}
                    onChange={(e) => setNewDriverPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                    placeholder="+375291234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Тип транспорта *
                  </label>
                  <select
                    value={newDriverVehicleType}
                    onChange={(e) => setNewDriverVehicleType(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                  >
                    <option value="">Выберите тип</option>
                    <option value="car">Автомобиль</option>
                    <option value="motorcycle">Мотоцикл</option>
                    <option value="bicycle">Велосипед</option>
                    <option value="walking">Пешком</option>
                  </select>
                </div>

                {(newDriverVehicleType === 'car' || newDriverVehicleType === 'motorcycle') && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Марка транспорта
                      </label>
                      <input
                        type="text"
                        value={newDriverVehicleBrand}
                        onChange={(e) => setNewDriverVehicleBrand(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                        placeholder="Toyota, BMW, Honda и т.д."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">
                        Модель транспорта
                      </label>
                      <input
                        type="text"
                        value={newDriverVehicleModel}
                        onChange={(e) => setNewDriverVehicleModel(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                        placeholder="Camry, X5, CBR600 и т.д."
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Номер транспорта
                  </label>
                  <input
                    type="text"
                    value={newDriverVehicleNumber}
                    onChange={(e) => setNewDriverVehicleNumber(e.target.value)}
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
                    value={newDriverLicenseNumber}
                    onChange={(e) => setNewDriverLicenseNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                    placeholder="AB1234567"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition"
                  >
                    {creating ? 'Создание...' : 'Создать водителя'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setError(null)
                      setNewDriverEmail('')
                      setNewDriverPassword('')
                      setNewDriverFullName('')
                      setNewDriverPhone('')
                      setNewDriverVehicleType('')
                      setNewDriverVehicleNumber('')
                      setNewDriverLicenseNumber('')
                    }}
                    className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-700 text-white transition"
                  >
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Нижняя навигация */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-50">
        <div className="flex justify-around items-center h-16">
          <a
            href="/dashboard/customer"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Главная</span>
          </a>
          <a
            href="/dashboard/customer/drivers"
            className="flex flex-col items-center justify-center flex-1 h-full text-green-400 hover:text-green-300 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs">Водители</span>
          </a>
          <a
            href="/dashboard/customer/orders"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs">Заказы</span>
          </a>
          <a
            href="/dashboard/customer/finance"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Финансы</span>
          </a>
          <a
            href="/dashboard/customer/tracking"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-400 hover:text-green-400 transition"
          >
            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Отслеживание</span>
          </a>
        </div>
      </div>
    </div>
  )
}

