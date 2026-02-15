'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'
import { OrdersMap } from '@/components/map/OrdersMap'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import { AddressPickerMap } from '@/components/map/AddressPickerMap'
import { SinglePointMap } from '@/components/map/SinglePointMap'
import { formatAddressForCard, formatAddressForOrder } from '@/lib/utils/formatAddress'
import type { Region } from '@/lib/types'

export default function ClientDashboard() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<any[]>([])
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Состояния для модального окна добавления адреса
  const [showAddModal, setShowAddModal] = useState(false)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [regions, setRegions] = useState<Region[]>([])
  const [label, setLabel] = useState('')
  const [address, setAddress] = useState('')
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | undefined>()
  const [addressType, setAddressType] = useState<'pickup' | 'delivery' | 'both'>('both')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [entrance, setEntrance] = useState('')
  const [floor, setFloor] = useState('')
  const [apartment, setApartment] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showCallDriverModal, setShowCallDriverModal] = useState(false)
  const [ordersWithDrivers, setOrdersWithDrivers] = useState<any[]>([])

  const loadSavedAddresses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: addressesData, error: addressesError } = await supabase
      .rpc('get_user_saved_addresses', { user_uuid: user.id })

    if (addressesError) {
      console.error('Ошибка загрузки адресов:', addressesError)
    } else {
      // Берем первые 3 адреса
      setSavedAddresses((addressesData || []).slice(0, 3))
    }
  }, [supabase])

  const loadRegions = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('get_all_regions')
      if (error) {
        console.error('Ошибка загрузки регионов:', error)
      } else {
        setRegions(data || [])
      }
    } catch (err) {
      console.error('Ошибка загрузки регионов:', err)
    }
  }, [supabase])

  // Загрузка заказов с информацией о курьерах
  const loadOrdersWithDrivers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Получаем активные заказы (не completed и не cancelled)
    const { data: ordersData, error } = await supabase
      .from('orders')
      .select('id, pickup_address, delivery_address, status, executor_user_id, final_price, created_at')
      .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
      .not('status', 'in', '(completed,cancelled)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки заказов с курьерами:', error)
      setOrdersWithDrivers([])
      return
    }

    if (!ordersData || ordersData.length === 0) {
      setOrdersWithDrivers([])
      return
    }

    // Фильтруем только заказы с назначенными курьерами
    const ordersWithExecutors = ordersData.filter(order => order.executor_user_id !== null)

    if (ordersWithExecutors.length === 0) {
      setOrdersWithDrivers([])
      return
    }

    // Загружаем информацию о курьерах для каждого заказа
    const ordersWithDriverInfo = await Promise.all(
      ordersWithExecutors.map(async (order) => {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('id, full_name, phone')
          .eq('id', order.executor_user_id)
          .maybeSingle()

        return {
          ...order,
          driver: driverData || null,
        }
      })
    )

    // Сохраняем все заказы с курьерами (даже если у водителя нет телефона)
    setOrdersWithDrivers(ordersWithDriverInfo.filter(order => order.driver))
  }, [supabase])

  useEffect(() => {
    let isMounted = true
    
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        if (isMounted) {
          router.push('/login')
        }
        return
      }

      // Получаем только активные заказы (не completed и не cancelled)
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .or(`customer_id.eq.${user.id},client_id.eq.${user.id}`)
        .not('status', 'in', '(completed,cancelled)')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!isMounted) return

      if (error) {
        console.error('Ошибка загрузки заказов:', error)
      } else {
        setOrders(ordersData || [])
      }

      // Загружаем сохраненные адреса (первые 3)
      await loadSavedAddresses()
      
      // Загружаем заказы с курьерами для кнопки звонка
      await loadOrdersWithDrivers()
      
      if (isMounted) {
        setLoading(false)
      }
    }

    loadData()
    loadRegions()
    
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Убрали зависимости, чтобы избежать лишних перезагрузок

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'Ищем курьера'
      case 'courier_coming':
        return 'Курьер едет к вам'
      case 'courier_delivering':
        return 'Курьер доставляет заказ'
      case 'completed':
        return 'Заказ завершен'
      case 'cancelled':
        return 'Отменен'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'searching_courier':
        return 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50'
      case 'courier_coming':
        return 'text-blue-400 bg-blue-400/20 border-blue-400/50'
      case 'courier_delivering':
        return 'text-purple-400 bg-purple-400/20 border-purple-400/50'
      case 'completed':
        return 'text-green-400 bg-green-400/20 border-green-400/50'
      case 'cancelled':
        return 'text-red-400 bg-red-400/20 border-red-400/50'
      default:
        return 'text-gray-400 bg-gray-400/20 border-gray-400/50'
    }
  }

  const shouldBlink = (status: string) => {
    // Мигают только активные статусы
    return status === 'searching_courier' || status === 'courier_coming' || status === 'courier_delivering'
  }

  const detectRegionFromAddress = useCallback((addr: string, addressDetails?: any) => {
    if (!addr || !regions.length) return

    const addressLower = addr.toLowerCase()
    
    if (addressDetails?.state) {
      const stateName = addressDetails.state.toLowerCase()
      
      if (stateName.includes('минск') && !stateName.includes('область')) {
        const minskRegion = regions.find(r => r.name.toLowerCase() === 'минск')
        if (minskRegion) {
          setSelectedRegion(minskRegion.id)
          return
        }
      } else if (stateName.includes('минская область') || stateName.includes('минская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'минская область')
        if (region) {
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('брестская область') || stateName.includes('брестская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'брестская область')
        if (region) {
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('витебская область') || stateName.includes('витебская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'витебская область')
        if (region) {
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('гомельская область') || stateName.includes('гомельская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'гомельская область')
        if (region) {
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('гродненская область') || stateName.includes('гродненская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'гродненская область')
        if (region) {
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('могилевская область') || stateName.includes('могилёвская область') || stateName.includes('могилевская') || stateName.includes('могилёвская')) {
        const region = regions.find(r => r.name.toLowerCase().includes('могилевская область') || r.name.toLowerCase().includes('могилёвская область'))
        if (region) {
          setSelectedRegion(region.id)
          return
        }
      }
    }

    // Fallback
    if (addressLower.includes('минск') && !addressLower.includes('область')) {
      const minskRegion = regions.find(r => r.name.toLowerCase() === 'минск')
      if (minskRegion) {
        setSelectedRegion(minskRegion.id)
        return
      }
    } else if (addressLower.includes('минская область') || addressLower.includes('минская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'минская область')
      if (region) {
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('брестская область') || addressLower.includes('брестская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'брестская область')
      if (region) {
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('витебская область') || addressLower.includes('витебская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'витебская область')
      if (region) {
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('гомельская область') || addressLower.includes('гомельская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'гомельская область')
      if (region) {
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('гродненская область') || addressLower.includes('гродненская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'гродненская область')
      if (region) {
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('могилевская область') || addressLower.includes('могилёвская область') || addressLower.includes('могилевская') || addressLower.includes('могилёвская')) {
      const region = regions.find(r => r.name.toLowerCase().includes('могилевская область') || r.name.toLowerCase().includes('могилёвская область'))
      if (region) {
        setSelectedRegion(region.id)
        return
      }
    }
  }, [regions])

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Пользователь не авторизован')
      }

      if (!address || !label) {
        throw new Error('Заполните все обязательные поля')
      }

      const coords = coordinates || { lat: 53.9045, lon: 27.5615 }
      const point = `POINT(${coords.lon} ${coords.lat})`

      // Если это адрес по умолчанию, снимаем флаг с других адресов того же типа
      if (isDefault) {
        await supabase
          .from('saved_addresses')
          .update({ is_default: false })
          .eq('user_id', user.id)
          .eq('address_type', addressType)
      }

      const { error: insertError } = await supabase
        .from('saved_addresses')
        .insert({
          user_id: user.id,
          label,
          address,
          coordinates: point,
          address_type: addressType,
          region_id: selectedRegion || null,
          entrance: entrance || null,
          floor: floor || null,
          apartment: apartment || null,
          is_default: isDefault,
        })

      if (insertError) throw insertError

      await loadSavedAddresses()
      setShowAddModal(false)
      setLabel('')
      setAddress('')
      setCoordinates(undefined)
      setAddressType('both')
      setSelectedRegion('')
      setEntrance('')
      setFloor('')
      setApartment('')
      setIsDefault(false)
      setError(null)
    } catch (err: any) {
      console.error('Ошибка сохранения адреса:', err)
      setError(err.message || 'Ошибка сохранения адреса')
    } finally {
      setSaving(false)
    }
  }

  const handleCallDriver = () => {
    if (ordersWithDrivers.length === 0) {
      alert('У вас нет активных заказов с курьерами')
      return
    }

    if (ordersWithDrivers.length === 1) {
      // Если заказ один, сразу звоним
      const order = ordersWithDrivers[0]
      if (order.driver?.phone) {
        window.location.href = `tel:${order.driver.phone}`
      }
    } else {
      // Если заказов несколько, показываем модальное окно для выбора
      setShowCallDriverModal(true)
    }
  }

  const handleCallDriverFromModal = (phone: string) => {
    setShowCallDriverModal(false)
    window.location.href = `tel:${phone}`
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Главная</h1>

      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Быстрые действия</h2>
        <div className="grid grid-cols-2 gap-4">
          <a
            href="/dashboard/client/create-order"
            className="bg-green-600 text-white p-4 rounded-lg text-center hover:bg-green-700 transition"
          >
            Создать заказ
          </a>
          <button
            onClick={handleCallDriver}
            className="bg-blue-600 text-white p-4 rounded-lg text-center hover:bg-blue-700 transition"
          >
            Позвонить курьеру
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-white">Мои активные заказы</h2>
        {loading ? (
          <p className="text-gray-400">Загрузка...</p>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            {orders.map((order: any) => {
              // Проверяем, можно ли редактировать заказ
              const canEdit = order.status === 'searching_courier' && !order.executor_user_id
              
              return (
                <div
                  key={order.id}
                  className="border border-gray-700 rounded-lg p-4 bg-gray-700 hover:bg-gray-600 transition"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-300 mt-1">
                        а) {formatAddressForOrder(order.pickup_address)}
                      </p>
                      <p className="text-sm text-gray-300 mt-1">
                        б) {formatAddressForOrder(order.delivery_address)}
                      </p>
                      <div className="mt-1">
                        <span className="text-sm text-gray-400">Статус: </span>
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                            getStatusColor(order.status)
                          } ${shouldBlink(order.status) ? 'animate-blink' : ''}`}
                        >
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-semibold text-lg text-white">{order.final_price} BYN</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/dashboard/client/orders/${order.id}/edit`)
                        }}
                        className="flex-1 bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 transition"
                      >
                        Редактировать
                      </button>
                    )}
                    <button
                      onClick={() => router.push(`/dashboard/client/orders/${order.id}`)}
                      className={`${canEdit ? 'flex-1' : 'w-full'} bg-blue-600 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-700 transition`}
                    >
                      Детали
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400">У вас пока нет активных заказов</p>
        )}
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Мои адреса</h2>
          <a
            href="/dashboard/client/addresses"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Все адреса →
          </a>
        </div>
        
        <div className="grid grid-cols-4 gap-3">
          {savedAddresses.map((addr) => (
            <div
              key={addr.id}
              className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition border border-gray-600 hover:border-green-500"
              onClick={() => router.push('/dashboard/client/addresses')}
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-white flex-1 line-clamp-1">{addr.label}</h3>
                {addr.is_default && (
                  <span className="px-1 py-0.5 bg-green-600 text-white text-xs rounded ml-1">
                    ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 line-clamp-3 mb-1">
                {formatAddressForCard(addr.address, addr.entrance, addr.floor, addr.apartment)}
              </p>
            </div>
          ))}
          
          {/* Квадратик для добавления нового адреса - всегда показывается */}
          <div
            onClick={() => setShowAddModal(true)}
            className="bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-600 transition border-2 border-dashed border-gray-600 hover:border-green-500 flex flex-col items-center justify-center min-h-[100px]"
          >
            <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <p className="text-xs text-gray-400 font-medium">Добавить</p>
          </div>
        </div>
      </div>

      {/* Модальное окно для добавления адреса */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveAddress} className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Добавить адрес</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setShowMapPicker(false)
                    setLabel('')
                    setAddress('')
                    setCoordinates(undefined)
                    setAddressType('both')
                    setSelectedRegion('')
                    setEntrance('')
                    setFloor('')
                    setApartment('')
                    setIsDefault(false)
                    setError(null)
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

              <div className="space-y-4">
                <div>
                  <label htmlFor="label" className="block text-sm font-medium text-gray-300 mb-1">
                    Название адреса *
                  </label>
                  <input
                    type="text"
                    id="label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                    placeholder="Например: Дом, Офис, Магазин"
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="address" className="block text-sm font-medium text-gray-300">
                      Адрес *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowMapPicker(true)}
                      className="text-xs text-green-400 hover:text-green-300 underline"
                    >
                      Указать на карте
                    </button>
                  </div>
                  <AddressAutocomplete
                    id="address"
                    value={address}
                    onChange={(addr, coords, addressDetails) => {
                      setAddress(addr)
                      setCoordinates(coords)
                      if (addr) {
                        detectRegionFromAddress(addr, addressDetails)
                      }
                    }}
                    placeholder="Начните вводить адрес"
                    required
                    className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                  />
                  
                  {/* Карта для отображения выбранного адреса */}
                  {coordinates && (
                    <div className="mt-3">
                      <SinglePointMap
                        coordinates={coordinates}
                        address={address}
                        height="300px"
                      />
                    </div>
                  )}
                  
                  {/* Дополнительные поля */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label htmlFor="entrance" className="block text-xs text-gray-400 mb-1">
                        Подъезд
                      </label>
                      <input
                        type="text"
                        id="entrance"
                        value={entrance}
                        onChange={(e) => setEntrance(e.target.value)}
                        placeholder="1"
                        className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="floor" className="block text-xs text-gray-400 mb-1">
                        Этаж
                      </label>
                      <input
                        type="text"
                        id="floor"
                        value={floor}
                        onChange={(e) => setFloor(e.target.value)}
                        placeholder="3"
                        className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="apartment" className="block text-xs text-gray-400 mb-1">
                        Квартира
                      </label>
                      <input
                        type="text"
                        id="apartment"
                        value={apartment}
                        onChange={(e) => setApartment(e.target.value)}
                        placeholder="12"
                        className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="addressType" className="block text-sm font-medium text-gray-300 mb-1">
                    Тип адреса *
                  </label>
                  <select
                    id="addressType"
                    value={addressType}
                    onChange={(e) => setAddressType(e.target.value as any)}
                    required
                    className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white"
                  >
                    <option value="both">Отправление и доставка</option>
                    <option value="pickup">Только отправление</option>
                    <option value="delivery">Только доставка</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="region" className="block text-sm font-medium text-gray-300 mb-1">
                    Регион
                  </label>
                  <select
                    id="region"
                    value={selectedRegion}
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    disabled={!address}
                    className={`w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 ${!address ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Выберите регион</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name} - {region.base_price} BYN
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDefault"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                  />
                  <label htmlFor="isDefault" className="ml-2 text-sm text-gray-300">
                    Установить как адрес по умолчанию
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setShowMapPicker(false)
                    setLabel('')
                    setAddress('')
                    setCoordinates(undefined)
                    setAddressType('both')
                    setSelectedRegion('')
                    setEntrance('')
                    setFloor('')
                    setApartment('')
                    setIsDefault(false)
                    setError(null)
                  }}
                  className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-700 text-white transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {saving ? 'Сохранение...' : 'Сохранить адрес'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно для выбора адреса на карте */}
      {showMapPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Выберите адрес на карте</h2>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <AddressPickerMap
                onSelect={async (coords) => {
                  setCoordinates(coords)
                  // Обратный геокодинг для получения адреса
                  try {
                    const response = await fetch(
                      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lon}&zoom=18&addressdetails=1`
                    )
                    if (response.ok) {
                      const data = await response.json()
                      if (data && data.display_name) {
                        // Форматируем адрес: убираем район и почтовый индекс
                        const parts = data.display_name.split(',')
                        const filteredParts = parts.filter(
                          (part: string) =>
                            !part.includes('район') &&
                            !part.includes('Район') &&
                            !/\d{6}/.test(part.trim())
                        )
                        const formattedAddress = filteredParts.join(',').trim()
                        setAddress(formattedAddress)
                        if (regions.length > 0) {
                          detectRegionFromAddress(formattedAddress, data.address)
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Ошибка получения адреса:', error)
                  }
                  setShowMapPicker(false)
                }}
                initialCoordinates={coordinates}
                height="500px"
                label="Кликните на карте, чтобы выбрать адрес"
              />

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMapPicker(false)}
                  className="px-6 py-2 border border-gray-600 rounded-md hover:bg-gray-700 text-white transition"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для выбора заказа для звонка курьеру */}
      {showCallDriverModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Выберите заказ</h2>
                <button
                  type="button"
                  onClick={() => setShowCallDriverModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3">
                {ordersWithDrivers
                  .filter(order => order.driver?.phone) // Показываем только заказы с телефонами
                  .map((order) => (
                    <div
                      key={order.id}
                      className="bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-600 transition border border-gray-600"
                      onClick={() => order.driver?.phone && handleCallDriverFromModal(order.driver.phone)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-white">Заказ №{order.order_number || order.id.slice(0, 8)}</p>
                          <p className="text-sm text-gray-300 mt-1">
                            а) {formatAddressForOrder(order.pickup_address)}
                          </p>
                          <p className="text-sm text-gray-300 mt-1">
                            б) {formatAddressForOrder(order.delivery_address)}
                          </p>
                          {order.driver?.full_name && (
                            <p className="text-xs text-gray-400 mt-1">Курьер: {order.driver.full_name}</p>
                          )}
                        </div>
                        {order.driver?.phone && (
                          <div className="ml-4">
                            <a
                              href={`tel:${order.driver.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 transition flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              {order.driver.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ClientBottomNavigation />
    </div>
  )
}
