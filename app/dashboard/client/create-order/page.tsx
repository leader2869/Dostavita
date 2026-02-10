'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Region } from '@/lib/types'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'

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
      // Получаем текущего пользователя
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Пользователь не авторизован')
        setLoading(false)
        return
      }

      // Получаем координаты адресов (упрощенная версия - в реальном проекте используйте геокодинг)
      // Для теста используем координаты Минска
      const pickupCoords = { lat: 53.9045, lng: 27.5615 }
      const deliveryCoords = { lat: 53.9045, lng: 27.5615 }

      // Получаем базовую цену региона
      const selectedRegionData = regions.find(r => r.id === selectedRegion)
      const basePrice = selectedRegionData?.base_price || 10.00

      // Создаем заказ
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_id: user.id, // Клиент может быть отправителем
          client_id: user.id, // И получателем одновременно
          pickup_address: pickupAddress,
          pickup_coordinates: `(${pickupCoords.lat},${pickupCoords.lng})`,
          delivery_address: deliveryAddress,
          delivery_coordinates: `(${deliveryCoords.lat},${deliveryCoords.lng})`,
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
          <label htmlFor="pickupAddress" className="block text-sm font-medium text-gray-300 mb-1">
            Адрес отправления
          </label>
          <input
            id="pickupAddress"
            type="text"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="Введите адрес отправления"
          />
        </div>

        <div>
          <label htmlFor="deliveryAddress" className="block text-sm font-medium text-gray-300 mb-1">
            Адрес доставки
          </label>
          <input
            id="deliveryAddress"
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
            placeholder="Введите адрес доставки"
          />
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-300 mb-1">
            Регион
          </label>
          <select
            id="region"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id} className="bg-gray-700">
                {region.name} - {region.base_price} BYN
              </option>
            ))}
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
            <option value="parcel" className="bg-gray-700">Посылка</option>
            <option value="documents" className="bg-gray-700">Документы</option>
            <option value="flowers" className="bg-gray-700">Цветы</option>
            <option value="food" className="bg-gray-700">Еда</option>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {loading ? 'Создание заказа...' : 'Создать заказ'}
        </button>
      </form>

      <ClientBottomNavigation />
    </div>
  )
}

