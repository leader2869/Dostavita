'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Region } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'

export default function CreateOrderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Форма заказа
  const [pickupAddress, setPickupAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [pickupCoordinates, setPickupCoordinates] = useState<{ lat: number; lon: number } | undefined>()
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ lat: number; lon: number } | undefined>()
  const [description, setDescription] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [itemType, setItemType] = useState<'documents' | 'parcel' | 'flowers' | 'food'>('parcel')

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
          return
        }
      } else if (stateName.includes('минская область') || stateName.includes('минская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'минская область')
        if (region) {
          console.log('Найден регион Минская область:', region.id)
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('брестская область') || stateName.includes('брестская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'брестская область')
        if (region) {
          console.log('Найден регион Брестская область:', region.id)
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('витебская область') || stateName.includes('витебская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'витебская область')
        if (region) {
          console.log('Найден регион Витебская область:', region.id)
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('гомельская область') || stateName.includes('гомельская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'гомельская область')
        if (region) {
          console.log('Найден регион Гомельская область:', region.id)
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('гродненская область') || stateName.includes('гродненская')) {
        const region = regions.find(r => r.name.toLowerCase() === 'гродненская область')
        if (region) {
          console.log('Найден регион Гродненская область:', region.id)
          setSelectedRegion(region.id)
          return
        }
      } else if (stateName.includes('могилевская область') || stateName.includes('могилёвская область') || stateName.includes('могилевская') || stateName.includes('могилёвская')) {
        const region = regions.find(r => r.name.toLowerCase().includes('могилевская область') || r.name.toLowerCase().includes('могилёвская область'))
        if (region) {
          console.log('Найден регион Могилевская область:', region.id)
          setSelectedRegion(region.id)
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
        return
      }
    } else if (addressLower.includes('минская область') || addressLower.includes('минская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'минская область')
      if (region) {
        console.log('Найден регион Минская область (fallback):', region.id)
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('брестская область') || addressLower.includes('брестская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'брестская область')
      if (region) {
        console.log('Найден регион Брестская область (fallback):', region.id)
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('витебская область') || addressLower.includes('витебская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'витебская область')
      if (region) {
        console.log('Найден регион Витебская область (fallback):', region.id)
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('гомельская область') || addressLower.includes('гомельская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'гомельская область')
      if (region) {
        console.log('Найден регион Гомельская область (fallback):', region.id)
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('гродненская область') || addressLower.includes('гродненская')) {
      const region = regions.find(r => r.name.toLowerCase() === 'гродненская область')
      if (region) {
        console.log('Найден регион Гродненская область (fallback):', region.id)
        setSelectedRegion(region.id)
        return
      }
    } else if (addressLower.includes('могилевская область') || addressLower.includes('могилёвская область') || addressLower.includes('могилевская') || addressLower.includes('могилёвская')) {
      const region = regions.find(r => r.name.toLowerCase().includes('могилевская область') || r.name.toLowerCase().includes('могилёвская область'))
      if (region) {
        console.log('Найден регион Могилевская область (fallback):', region.id)
        setSelectedRegion(region.id)
        return
      }
    }
    
    console.log('Регион не найден для адреса:', address)
  }, [regions])

  const loadRegions = useCallback(async () => {
    const { data } = await supabase
      .from('regions')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (data) {
      setRegions(data)
      if (data.length > 0) {
        setSelectedRegion(data[0].id)
      }
    }
  }, [supabase])

  useEffect(() => {
    loadRegions()
  }, [loadRegions])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Используем координаты из автодополнения или координаты по умолчанию (Минск)
      const pickupCoords = pickupCoordinates || { lat: 53.9045, lon: 27.5615 }
      const deliveryCoords = deliveryCoordinates || { lat: 53.9045, lon: 27.5615 }

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) {
        throw new Error('Не авторизован')
      }

      const selectedRegionData = regions.find(r => r.id === selectedRegion)
      if (!selectedRegionData) {
        throw new Error('Регион не выбран')
      }

      // Форматируем координаты для PostgreSQL POINT
      const pickupPoint = `(${pickupCoords.lon}, ${pickupCoords.lat})`
      const deliveryPoint = `(${deliveryCoords.lon}, ${deliveryCoords.lat})`

      const { data, error: insertError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.user.id,
          pickup_address: pickupAddress,
          pickup_coordinates: pickupPoint,
          delivery_address: deliveryAddress,
          delivery_coordinates: deliveryPoint,
          description: description,
          region_id: selectedRegion,
          base_price: selectedRegionData.base_price,
          final_price: selectedRegionData.base_price,
          item_type: itemType,
          status: 'searching_courier',
          visibility: 'public',
        })
        .select()
        .single()

      if (insertError) {
        throw insertError
      }

      router.push('/dashboard/customer')
    } catch (err: any) {
      setError(err.message || 'Ошибка создания заказа')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Создать заказ</h1>

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Адрес отправления
          </label>
          <AddressAutocomplete
            value={pickupAddress}
            onChange={(address, coordinates, addressDetails) => {
              console.log('AddressAutocomplete onChange:', { address, coordinates, addressDetails })
              setPickupAddress(address)
              setPickupCoordinates(coordinates)
              // Автоматически определяем регион по адресу отправления
              // Используем setTimeout чтобы убедиться, что регионы уже загружены
              setTimeout(() => {
                if (address && regions.length > 0) {
                  detectRegionFromAddress(address, addressDetails)
                } else {
                  console.log('Регионы еще не загружены или адрес пуст')
                }
              }, 100)
            }}
            placeholder="Начните вводить адрес отправления"
            required
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Адрес доставки
          </label>
          <AddressAutocomplete
            value={deliveryAddress}
            onChange={(address, coordinates) => {
              setDeliveryAddress(address)
              setDeliveryCoordinates(coordinates)
            }}
            placeholder="Начните вводить адрес доставки"
            required
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Регион
          </label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name} - {region.base_price} BYN
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Тип груза
          </label>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value as any)}
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
          >
            <option value="documents">Документы</option>
            <option value="parcel">Посылка</option>
            <option value="flowers">Цветы</option>
            <option value="food">Еда</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Описание
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
            rows={3}
            placeholder="Дополнительная информация о заказе"
          />
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Создание...' : 'Создать заказ'}
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

