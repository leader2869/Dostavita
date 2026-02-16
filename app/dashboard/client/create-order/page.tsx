'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Region } from '@/lib/types'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import { OrderMap } from '@/components/map/OrderMap'
import { AddressPickerMap } from '@/components/map/AddressPickerMap'
import { formatAddressForCard } from '@/lib/utils/formatAddress'

export default function CreateOrderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingRegions, setLoadingRegions] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Форма заказа
  const [pickupAddress, setPickupAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [pickupCoordinates, setPickupCoordinates] = useState<{ lat: number; lon: number } | undefined>()
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lon: number } | undefined>()
  const [pickupEntrance, setPickupEntrance] = useState('')
  const [pickupFloor, setPickupFloor] = useState('')
  const [pickupApartment, setPickupApartment] = useState('')
  const [deliveryEntrance, setDeliveryEntrance] = useState('')
  const [deliveryFloor, setDeliveryFloor] = useState('')
  const [deliveryApartment, setDeliveryApartment] = useState('')
  const [senderPhone, setSenderPhone] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [itemType, setItemType] = useState<'documents' | 'parcel' | 'flowers' | 'food' | 'other'>('flowers')
  const [regionAutoDetected, setRegionAutoDetected] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<any[]>([])
  const [showSavedAddressesModal, setShowSavedAddressesModal] = useState(false)
  const [savedAddressType, setSavedAddressType] = useState<'pickup' | 'delivery' | null>(null)
  const [pickupRegionName, setPickupRegionName] = useState<string | null>(null)
  const [showMapPicker, setShowMapPicker] = useState(false)
  const [mapPickerType, setMapPickerType] = useState<'pickup' | 'delivery' | null>(null)
  const [routeDistance, setRouteDistance] = useState<number | null>(null) // расстояние в км
  const [routeDuration, setRouteDuration] = useState<number | null>(null) // время в минутах
  const [calculatingRoute, setCalculatingRoute] = useState(false)

  // Функция для определения региона по адресу
  const detectRegionFromAddress = useCallback((address: string, addressDetails?: any) => {
    console.log('detectRegionFromAddress вызвана:', { address, addressDetails, regionsCount: regions.length })
    
    if (!address || !regions.length) {
      console.log('Пропуск: нет адреса или регионов не загружены')
      return
    }

    const addressLower = address.toLowerCase()
    
    // Проверяем по названию области из адреса (Nominatim возвращает address.state)
    if (addressDetails?.state) {
      const stateName = addressDetails.state.toLowerCase()
      console.log('Проверяем state:', stateName)
      
      // Сопоставляем область с регионом
      if (stateName.includes('минск') && !stateName.includes('область')) {
        // Минск (город)
        const minskRegion = regions.find(r => r.name.toLowerCase() === 'минск')
        if (minskRegion) {
          console.log('Найден регион Минск:', minskRegion.id)
          setSelectedRegion(minskRegion.id)
          setRegionAutoDetected(true)
          setPickupRegionName('Минск')
          return
        }
      } else if (stateName.includes('минская область') || stateName.includes('минская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'минская область')
        if (region) {
          console.log('Найден регион Минская область:', region.id)
          setSelectedRegion(region.id)
          setRegionAutoDetected(true)
          setPickupRegionName('Минская область')
          return
        }
      } else if (stateName.includes('брестская область') || stateName.includes('брестская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'брестская область')
        if (region) {
          console.log('Найден регион Брестская область:', region.id)
          setSelectedRegion(region.id)
          setRegionAutoDetected(true)
          setPickupRegionName('Брестская область')
          return
        }
      } else if (stateName.includes('витебская область') || stateName.includes('витебская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'витебская область')
        if (region) {
          console.log('Найден регион Витебская область:', region.id)
          setSelectedRegion(region.id)
          setRegionAutoDetected(true)
          setPickupRegionName('Витебская область')
          return
        }
      } else if (stateName.includes('гомельская область') || stateName.includes('гомельская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'гомельская область')
        if (region) {
          console.log('Найден регион Гомельская область:', region.id)
          setSelectedRegion(region.id)
          setRegionAutoDetected(true)
          setPickupRegionName('Гомельская область')
          return
        }
      } else if (stateName.includes('гродненская область') || stateName.includes('гродненская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'гродненская область')
        if (region) {
          console.log('Найден регион Гродненская область:', region.id)
          setSelectedRegion(region.id)
          setRegionAutoDetected(true)
          setPickupRegionName('Гродненская область')
          return
        }
      } else if (stateName.includes('могилевская область') || stateName.includes('могилёвская область') || stateName.includes('могилевская') || stateName.includes('могилёвская')) {
        const region = regions.find(r => r.name.toLowerCase().includes('могилевская область') || r.name.toLowerCase().includes('могилёвская область'))
        if (region) {
          console.log('Найден регион Могилевская область:', region.id)
          setSelectedRegion(region.id)
          setRegionAutoDetected(true)
          setPickupRegionName(region.name)
          return
        }
      }
    }

    // Fallback: проверяем по тексту адреса
    console.log('Fallback: проверяем по тексту адреса')
    if (addressLower.includes('минск') && !addressLower.includes('область')) {
      const minskRegion = regions.find(r => r.name.toLowerCase() === 'минск')
      if (minskRegion) {
        console.log('Найден регион Минск (fallback):', minskRegion.id)
        setSelectedRegion(minskRegion.id)
        setRegionAutoDetected(true)
        setPickupRegionName('Минск')
        return
      }
    } else if (addressLower.includes('минская область') || addressLower.includes('минская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'минская область')
      if (region) {
        console.log('Найден регион Минская область (fallback):', region.id)
        setSelectedRegion(region.id)
        setRegionAutoDetected(true)
        setPickupRegionName('Минская область')
        return
      }
    } else if (addressLower.includes('брестская область') || addressLower.includes('брестская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'брестская область')
      if (region) {
        console.log('Найден регион Брестская область (fallback):', region.id)
        setSelectedRegion(region.id)
        setRegionAutoDetected(true)
        setPickupRegionName('Брестская область')
        return
      }
    } else if (addressLower.includes('витебская область') || addressLower.includes('витебская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'витебская область')
      if (region) {
        console.log('Найден регион Витебская область (fallback):', region.id)
        setSelectedRegion(region.id)
        setRegionAutoDetected(true)
        setPickupRegionName('Витебская область')
        return
      }
    } else if (addressLower.includes('гомельская область') || addressLower.includes('гомельская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'гомельская область')
      if (region) {
        console.log('Найден регион Гомельская область (fallback):', region.id)
        setSelectedRegion(region.id)
        setRegionAutoDetected(true)
        setPickupRegionName('Гомельская область')
        return
      }
    } else if (addressLower.includes('гродненская область') || addressLower.includes('гродненская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'гродненская область')
      if (region) {
        console.log('Найден регион Гродненская область (fallback):', region.id)
        setSelectedRegion(region.id)
        setRegionAutoDetected(true)
        setPickupRegionName('Гродненская область')
        return
      }
    } else if (addressLower.includes('могилевская область') || addressLower.includes('могилёвская область') || addressLower.includes('могилевская') || addressLower.includes('могилёвская')) {
      const region = regions.find(r => r.name.toLowerCase().includes('могилевская область') || r.name.toLowerCase().includes('могилёвская область'))
      if (region) {
        console.log('Найден регион Могилевская область (fallback):', region.id)
        setSelectedRegion(region.id)
        setRegionAutoDetected(true)
        setPickupRegionName(region.name)
        return
      }
    }
    
    console.log('Регион не найден для адреса:', address)
  }, [regions])

  const loadRegions = useCallback(async () => {
    setLoadingRegions(true)
    setError(null)
    
    try {
      // Пробуем использовать RPC функцию (обходит RLS)
      let { data, error } = await supabase
        .rpc('get_all_regions')

      // Если RPC не работает, пробуем прямой запрос
      if (error || !data) {
        console.log('RPC не сработал, пробуем прямой запрос регионов...')
        const result = await supabase
          .from('regions')
          .select('*')
          .eq('is_active', true)
          .order('name')
        
        data = result.data
        error = result.error
      }

      if (error) {
        console.error('Ошибка загрузки регионов:', error)
        setError(`Ошибка загрузки регионов: ${error.message}`)
        setLoadingRegions(false)
        return
      }

      if (data) {
        // Фильтруем только активные регионы, если использовали RPC
        const activeRegions = data.filter((r: Region) => r.is_active !== false)
        setRegions(activeRegions)
        console.log('Загружено регионов:', activeRegions.length)
      } else {
        console.warn('Регионы не загружены: data is null')
        setError('Не удалось загрузить регионы')
      }
    } catch (err: any) {
      console.error('Исключение при загрузке регионов:', err)
      setError(`Ошибка: ${err.message}`)
    } finally {
      setLoadingRegions(false)
    }
  }, [supabase])

  const loadSavedAddresses = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .rpc('get_user_saved_addresses', { user_uuid: user.id })

      if (error) {
        console.error('Ошибка загрузки сохраненных адресов:', error)
      } else {
        setSavedAddresses(data || [])
      }
    } catch (err) {
      console.error('Ошибка загрузки сохраненных адресов:', err)
    }
  }, [supabase])

  // Функция для расчета маршрута через OSRM
  const calculateRoute = useCallback(async () => {
    if (!pickupCoordinates || !deliveryCoordinates) {
      setRouteDistance(null)
      setRouteDuration(null)
      return
    }

    setCalculatingRoute(true)
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${pickupCoordinates.lon},${pickupCoordinates.lat};${deliveryCoordinates.lon},${deliveryCoordinates.lat}?overview=false`
      )
      const data = await response.json()

      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0]
        // Расстояние в метрах, переводим в километры
        const distanceKm = (route.distance / 1000).toFixed(2)
        // Время в секундах, переводим в минуты
        const durationMinutes = Math.round(route.duration / 60)
        
        setRouteDistance(parseFloat(distanceKm))
        setRouteDuration(durationMinutes)
      } else {
        setRouteDistance(null)
        setRouteDuration(null)
      }
    } catch (error) {
      console.error('Ошибка расчета маршрута:', error)
      setRouteDistance(null)
      setRouteDuration(null)
    } finally {
      setCalculatingRoute(false)
    }
  }, [pickupCoordinates, deliveryCoordinates])

  // Автоматически рассчитываем маршрут при изменении координат
  useEffect(() => {
    if (pickupCoordinates && deliveryCoordinates) {
      // Небольшая задержка для дебаунса
      const timer = setTimeout(() => {
        calculateRoute()
      }, 500)
      return () => clearTimeout(timer)
    } else {
      setRouteDistance(null)
      setRouteDuration(null)
    }
  }, [pickupCoordinates, deliveryCoordinates, calculateRoute])

  // Загружаем телефон отправителя из профиля при монтировании
  useEffect(() => {
    const loadSenderPhone = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Используем RPC функцию для получения профиля (обходит RLS)
          const { data: profile, error: profileError } = await supabase
            .rpc('get_user_profile', { user_id: user.id })
            .single()
          
          if (!profileError && profile && typeof profile === 'object' && profile !== null && 'phone' in profile) {
            const phone = (profile as { phone?: string }).phone
            if (phone) {
              setSenderPhone(phone)
            }
          } else {
            // Fallback на прямой запрос, если RPC не работает
            const { data: directProfile } = await supabase
              .from('profiles')
              .select('phone')
              .eq('id', user.id)
              .maybeSingle()
            
            if (directProfile?.phone) {
              setSenderPhone(directProfile.phone)
            }
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки телефона отправителя:', error)
      }
    }

    loadSenderPhone()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // supabase - стабильный объект, не нужно включать в зависимости

  useEffect(() => {
    loadRegions()
    loadSavedAddresses()
  }, [loadRegions, loadSavedAddresses])

  const handleOpenSavedAddressesModal = (type: 'pickup' | 'delivery') => {
    setSavedAddressType(type)
    setShowSavedAddressesModal(true)
  }

  const handleSelectSavedAddress = (savedAddress: any) => {
    if (!savedAddressType) return

    setShowSavedAddressesModal(false)
    
    if (savedAddressType === 'pickup') {
      setPickupAddress(savedAddress.address)
      setPickupEntrance(savedAddress.entrance || '')
      setPickupFloor(savedAddress.floor || '')
      setPickupApartment(savedAddress.apartment || '')
      if (savedAddress.coordinates) {
        try {
          // Парсим WKT формат: POINT(lon lat)
          if (typeof savedAddress.coordinates === 'string') {
            const match = savedAddress.coordinates.match(/POINT\(([^ ]+) ([^ ]+)\)/)
            if (match && match.length === 3) {
              setPickupCoordinates({ lat: parseFloat(match[2]), lon: parseFloat(match[1]) })
            }
          } else {
            const coords = savedAddress.coordinates
            if (coords.coordinates && coords.coordinates.length === 2) {
              setPickupCoordinates({ lat: coords.coordinates[1], lon: coords.coordinates[0] })
            }
          }
        } catch (e) {
          console.error('Ошибка парсинга координат:', e)
        }
      }
      if (savedAddress.region_id) {
        setSelectedRegion(savedAddress.region_id)
        setRegionAutoDetected(true)
        // Устанавливаем название региона для фильтрации адреса доставки
        const region = regions.find(r => r.id === savedAddress.region_id)
        if (region) {
          setPickupRegionName(region.name)
        }
      }
    } else {
      setDeliveryAddress(savedAddress.address)
      setDeliveryEntrance(savedAddress.entrance || '')
      setDeliveryFloor(savedAddress.floor || '')
      setDeliveryApartment(savedAddress.apartment || '')
      if (savedAddress.coordinates) {
        try {
          // Парсим WKT формат: POINT(lon lat)
          if (typeof savedAddress.coordinates === 'string') {
            const match = savedAddress.coordinates.match(/POINT\(([^ ]+) ([^ ]+)\)/)
            if (match && match.length === 3) {
              setDeliveryCoordinates({ lat: parseFloat(match[2]), lon: parseFloat(match[1]) })
            }
          } else {
            const coords = savedAddress.coordinates
            if (coords.coordinates && coords.coordinates.length === 2) {
              setDeliveryCoordinates({ lat: coords.coordinates[1], lon: coords.coordinates[0] })
            }
          }
        } catch (e) {
          console.error('Ошибка парсинга координат:', e)
        }
      }
    }
    
    setSavedAddressType(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Валидация: проверяем, что регион выбран
      if (!selectedRegion || selectedRegion === '') {
        setError('Пожалуйста, выберите регион')
        setLoading(false)
        return
      }

      // Валидация: проверяем, что телефон отправителя указан
      if (!senderPhone || senderPhone.trim() === '') {
        setError('Пожалуйста, укажите телефон отправителя')
        setLoading(false)
        return
      }

      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Пользователь не авторизован')
        setLoading(false)
        return
      }

      // Используем координаты из автодополнения или координаты по умолчанию (Минск)
      const pickupCoords = pickupCoordinates || { lat: 53.9045, lon: 27.5615 }
      const deliveryCoords = deliveryCoordinates || { lat: 53.9045, lon: 27.5615 }

      // Получаем базовую цену региона
      const selectedRegionData = regions.find(r => r.id === selectedRegion)
      
      if (!selectedRegionData) {
        setError('Выбранный регион не найден')
        setLoading(false)
        return
      }

      const basePrice = selectedRegionData.base_price

      // Создаем заказ
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id, // Клиент может быть отправителем
          client_id: user.id, // И получателем одновременно
          pickup_address: pickupAddress,
          pickup_coordinates: `(${pickupCoords.lon},${pickupCoords.lat})`,
          pickup_entrance: pickupEntrance || null,
          pickup_floor: pickupFloor || null,
          pickup_apartment: pickupApartment || null,
          delivery_address: deliveryAddress,
          delivery_coordinates: `(${deliveryCoords.lon},${deliveryCoords.lat})`,
          delivery_entrance: deliveryEntrance || null,
          delivery_floor: deliveryFloor || null,
          delivery_apartment: deliveryApartment || null,
          sender_phone: senderPhone.trim(),
          recipient_phone: recipientPhone || null,
          description: description,
          region_id: selectedRegion,
          base_price: basePrice,
          final_price: basePrice,
          status: 'searching_courier',
          visibility: 'public',
          item_type: itemType,
        })
        .select()
        .single()

      if (orderError) {
        setError(orderError.message)
        setLoading(false)
        return
      }

      // Отправляем push-уведомления водителям о новом заказе
      try {
        await fetch('/api/orders/notify-drivers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: order.id,
            orderNumber: order.order_number,
            finalPrice: order.final_price,
          }),
        })
      } catch (notifyError) {
        // Не блокируем создание заказа, если уведомления не отправились
        console.error('Ошибка отправки push-уведомлений:', notifyError)
      }

      // Успешно создан заказ
      router.push('/dashboard/client/orders')
    } catch (err: any) {
      setError(err.message || 'Ошибка создания заказа')
      setLoading(false)
    }
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Создать заказ</h1>

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="pickupAddress" className="block text-lg font-semibold text-white">
              Адрес отправления
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMapPickerType('pickup')
                  setShowMapPicker(true)
                }}
                className="text-sm text-green-400 hover:text-green-300"
              >
                Указать на карте
              </button>
              {savedAddresses.filter(addr => addr.address_type === 'pickup' || addr.address_type === 'both').length > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenSavedAddressesModal('pickup')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Выбрать из сохраненных
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <AddressAutocomplete
              id="pickupAddress"
              value={pickupAddress}
              onChange={(address, coordinates, addressDetails) => {
                console.log('AddressAutocomplete onChange:', { address, coordinates, addressDetails })
                setPickupAddress(address)
                setPickupCoordinates(coordinates)
                // Автоматически определяем регион по адресу отправления
                if (address && regions.length > 0) {
                  detectRegionFromAddress(address, addressDetails)
                } else {
                  console.log('Регионы еще не загружены или адрес пуст')
                }
              }}
              placeholder="Начните вводить адрес отправления"
              required
              className="w-full px-3 py-2 pr-10 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            />
            {pickupAddress && (
              <button
                type="button"
                onClick={() => {
                  setPickupAddress('')
                  setPickupCoordinates(undefined)
                  setPickupEntrance('')
                  setPickupFloor('')
                  setPickupApartment('')
                  setSelectedRegion('')
                  setRegionAutoDetected(false)
                  setPickupRegionName(null)
                  setRouteDistance(null)
                  setRouteDuration(null)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 transition"
                title="Очистить адрес отправления"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Дополнительные поля для адреса отправления */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <label htmlFor="pickupEntrance" className="block text-xs text-gray-400 mb-1">
                Подъезд
              </label>
              <input
                type="text"
                id="pickupEntrance"
                value={pickupEntrance}
                onChange={(e) => setPickupEntrance(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pickupFloor" className="block text-xs text-gray-400 mb-1">
                Этаж
              </label>
              <input
                type="text"
                id="pickupFloor"
                value={pickupFloor}
                onChange={(e) => setPickupFloor(e.target.value)}
                placeholder="5"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="pickupApartment" className="block text-xs text-gray-400 mb-1">
                Квартира
              </label>
              <input
                type="text"
                id="pickupApartment"
                value={pickupApartment}
                onChange={(e) => setPickupApartment(e.target.value)}
                placeholder="12"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="deliveryAddress" className="block text-lg font-semibold text-white">
              Адрес доставки
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMapPickerType('delivery')
                  setShowMapPicker(true)
                }}
                className="text-sm text-green-400 hover:text-green-300"
              >
                Указать на карте
              </button>
              {savedAddresses.filter(addr => addr.address_type === 'delivery' || addr.address_type === 'both').length > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenSavedAddressesModal('delivery')}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Выбрать из сохраненных
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <AddressAutocomplete
              id="deliveryAddress"
              value={deliveryAddress}
              onChange={(address, coordinates) => {
                setDeliveryAddress(address)
                setDeliveryCoordinates(coordinates)
              }}
              placeholder={pickupRegionName ? `Начните вводить адрес доставки (${pickupRegionName})` : "Начните вводить адрес доставки"}
              filterByRegion={pickupRegionName}
              required
              className="w-full px-3 py-2 pr-10 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            />
            {deliveryAddress && (
              <button
                type="button"
                onClick={() => {
                  setDeliveryAddress('')
                  setDeliveryCoordinates(undefined)
                  setDeliveryEntrance('')
                  setDeliveryFloor('')
                  setDeliveryApartment('')
                  setRouteDistance(null)
                  setRouteDuration(null)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 transition"
                title="Очистить адрес доставки"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          {/* Дополнительные поля для адреса доставки */}
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div>
              <label htmlFor="deliveryEntrance" className="block text-xs text-gray-400 mb-1">
                Подъезд
              </label>
              <input
                type="text"
                id="deliveryEntrance"
                value={deliveryEntrance}
                onChange={(e) => setDeliveryEntrance(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="deliveryFloor" className="block text-xs text-gray-400 mb-1">
                Этаж
              </label>
              <input
                type="text"
                id="deliveryFloor"
                value={deliveryFloor}
                onChange={(e) => setDeliveryFloor(e.target.value)}
                placeholder="5"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
            <div>
              <label htmlFor="deliveryApartment" className="block text-xs text-gray-400 mb-1">
                Квартира
              </label>
              <input
                type="text"
                id="deliveryApartment"
                value={deliveryApartment}
                onChange={(e) => setDeliveryApartment(e.target.value)}
                placeholder="12"
                className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="senderPhone" className="block text-sm font-medium text-gray-300 mb-1">
            Телефон отправителя <span className="text-red-400">*</span>
          </label>
          <input
            type="tel"
            id="senderPhone"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="+375 (XX) XXX-XX-XX"
            required
          />
          <p className="text-xs text-gray-400 mt-1">Номер телефона отправителя (обязательно)</p>
        </div>

        <div>
          <label htmlFor="recipientPhone" className="block text-sm font-medium text-gray-300 mb-1">
            Телефон получателя
          </label>
          <input
            type="tel"
            id="recipientPhone"
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="+375 (XX) XXX-XX-XX"
          />
          <p className="text-xs text-gray-400 mt-1">Телефон получателя заказа (необязательно)</p>
        </div>

        {/* Информация о маршруте */}
        {(pickupCoordinates && deliveryCoordinates) && (
          <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-300 mb-2">Информация о маршруте</h3>
                {calculatingRoute ? (
                  <div className="flex items-center gap-2 text-gray-400">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Расчет маршрута...</span>
                  </div>
                ) : routeDistance !== null && routeDuration !== null ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">Расстояние</p>
                        <p className="text-lg font-semibold text-white">{routeDistance} км</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-xs text-gray-400">Время в пути (без учета пробок)</p>
                        <p className="text-lg font-semibold text-white">{routeDuration} мин</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Не удалось рассчитать маршрут</p>
                )}
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-300 mb-1">
            Регион
          </label>
          <select
            id="region"
            value={selectedRegion}
            onChange={(e) => {
              console.log('Выбран регион:', e.target.value)
              setSelectedRegion(e.target.value)
            }}
            disabled={!pickupAddress || regionAutoDetected || loadingRegions || regions.length === 0}
            required
            className={`w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 ${(!pickupAddress || regionAutoDetected) ? 'opacity-60 cursor-not-allowed' : 'disabled:opacity-50 disabled:cursor-not-allowed'}`}
          >
            {loadingRegions ? (
              <option value="" className="bg-gray-700">Загрузка регионов...</option>
            ) : regions.length === 0 ? (
              <option value="" className="bg-gray-700">Регионы не найдены</option>
            ) : (
              <>
                <option value="" className="bg-gray-700">Выберите регион</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id} className="bg-gray-700">
                    {region.name} - {region.base_price} BYN
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        <div>
          <label htmlFor="itemType" className="block text-sm font-medium text-gray-300 mb-1">
            Тип отправления
          </label>
          <select
            id="itemType"
            value={itemType}
            onChange={(e) => setItemType(e.target.value as any)}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
          >
            <option value="flowers" className="bg-gray-700">Цветы</option>
            <option value="parcel" className="bg-gray-700">Посылка</option>
            <option value="documents" className="bg-gray-700">Документы</option>
            <option value="food" className="bg-gray-700">Еда</option>
            <option value="other" className="bg-gray-700">Другое</option>
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">
            Описание
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="Дополнительная информация о заказе"
          />
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded border border-red-800">{error}</div>
        )}

        {/* Карта с адресами */}
        {(pickupCoordinates || deliveryCoordinates) && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Карта маршрута</h3>
            <OrderMap
              pickupCoordinates={pickupCoordinates}
              deliveryCoordinates={deliveryCoordinates}
              height="300px"
              showRoute={pickupCoordinates && deliveryCoordinates ? true : false}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {loading ? 'Создание заказа...' : 'Создать заказ'}
        </button>
      </form>

      {/* Модальное окно для выбора адреса на карте */}
      {showMapPicker && mapPickerType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  Выберите {mapPickerType === 'pickup' ? 'адрес отправления' : 'адрес доставки'} на карте
                </h2>
                <button
                  onClick={() => {
                    setShowMapPicker(false)
                    setMapPickerType(null)
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <AddressPickerMap
                onSelect={async (coordinates) => {
                  // Обратный геокодинг для получения адреса
                  try {
                    const response = await fetch(
                      `/api/nominatim/reverse?lat=${coordinates.lat}&lon=${coordinates.lon}`
                    )
                    if (response.ok) {
                      const data = await response.json()
                      if (data.address) {
                        if (mapPickerType === 'pickup') {
                          setPickupAddress(data.address)
                          setPickupCoordinates(coordinates)
                          if (regions.length > 0) {
                            detectRegionFromAddress(data.address, data.addressDetails)
                          }
                        } else {
                          setDeliveryAddress(data.address)
                          setDeliveryCoordinates(coordinates)
                        }
                        setShowMapPicker(false)
                        setMapPickerType(null)
                      }
                    }
                  } catch (error) {
                    console.error('Ошибка получения адреса:', error)
                    // Если API не работает, просто используем координаты
                    if (mapPickerType === 'pickup') {
                      setPickupCoordinates(coordinates)
                    } else {
                      setDeliveryCoordinates(coordinates)
                    }
                    setShowMapPicker(false)
                    setMapPickerType(null)
                  }
                }}
                initialCoordinates={
                  mapPickerType === 'pickup' ? pickupCoordinates : deliveryCoordinates
                }
                height="500px"
                label={`Кликните на карте, чтобы выбрать ${mapPickerType === 'pickup' ? 'адрес отправления' : 'адрес доставки'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для выбора сохраненных адресов */}
      {showSavedAddressesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  Выбрать адрес {savedAddressType === 'pickup' ? 'отправления' : 'доставки'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowSavedAddressesModal(false)
                    setSavedAddressType(null)
                  }}
                  className="text-gray-400 hover:text-white transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {savedAddresses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">У вас пока нет сохраненных адресов</p>
                  <a
                    href="/dashboard/client/addresses"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Добавить адрес
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedAddresses
                    .filter(addr => {
                      if (savedAddressType === 'pickup') {
                        return addr.address_type === 'pickup' || addr.address_type === 'both'
                      } else {
                        return addr.address_type === 'delivery' || addr.address_type === 'both'
                      }
                    })
                    .map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => handleSelectSavedAddress(addr)}
                        className="w-full text-left p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-white">{addr.label}</p>
                              {addr.is_default && (
                                <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                                  По умолчанию
                                </span>
                              )}
                              <span className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded">
                                {addr.address_type === 'pickup' ? 'Отправление' :
                                 addr.address_type === 'delivery' ? 'Доставка' : 'Оба'}
                              </span>
                            </div>
                            <p className="text-sm text-gray-300">
                              {formatAddressForCard(addr.address, addr.entrance, addr.floor, addr.apartment)}
                            </p>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  {savedAddresses.filter(addr => {
                    if (savedAddressType === 'pickup') {
                      return addr.address_type === 'pickup' || addr.address_type === 'both'
                    } else {
                      return addr.address_type === 'delivery' || addr.address_type === 'both'
                    }
                  }).length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-4">
                        Нет сохраненных адресов для {savedAddressType === 'pickup' ? 'отправления' : 'доставки'}
                      </p>
                      <a
                        href="/dashboard/client/addresses"
                        className="text-blue-400 hover:text-blue-300 underline"
                      >
                        Добавить адрес
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ClientBottomNavigation />
    </div>
  )
}

