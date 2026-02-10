'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Region } from '@/lib/types'
import { BackButton } from '@/components/ui/BackButton'

export default function CreateOrderPage() {
  const router = useRouter()
  const supabase = createClient()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Форма заказа
  const [pickupAddress, setPickupAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [itemType, setItemType] = useState<'documents' | 'parcel' | 'flowers' | 'food'>('parcel')

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
      // Получаем координаты адресов (упрощенная версия - в реальном проекте используйте геокодинг)
      // Для теста используем координаты Минска
      const pickupCoords = { lat: 53.9045, lng: 27.5615 }
      const deliveryCoords = { lat: 53.9045, lng: 27.5615 }

      const { data: user } = await supabase.auth.getUser()
      if (!user.user) {
        throw new Error('Не авторизован')
      }

      const selectedRegionData = regions.find(r => r.id === selectedRegion)
      if (!selectedRegionData) {
        throw new Error('Регион не выбран')
      }

      // Форматируем координаты для PostgreSQL POINT
      const pickupPoint = `(${pickupCoords.lng}, ${pickupCoords.lat})`
      const deliveryPoint = `(${deliveryCoords.lng}, ${deliveryCoords.lat})`

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
      <h1 className="text-3xl font-bold mb-6">Создать заказ</h1>

      <form onSubmit={handleSubmit} className="bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Адрес отправления
          </label>
          <input
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
            placeholder="г. Минск, ул. Примерная, д. 1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Адрес доставки
          </label>
          <input
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            required
            className="w-full px-3 py-2 border border-gray-600 rounded-md"
            placeholder="г. Минск, ул. Примерная, д. 2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
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

