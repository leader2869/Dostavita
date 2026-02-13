'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Region } from '@/lib/types'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'

export default function EditOrderPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const supabase = createClient()
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Форма заказа
  const [pickupAddress, setPickupAddress] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [pickupEntrance, setPickupEntrance] = useState('')
  const [pickupFloor, setPickupFloor] = useState('')
  const [pickupApartment, setPickupApartment] = useState('')
  const [deliveryEntrance, setDeliveryEntrance] = useState('')
  const [deliveryFloor, setDeliveryFloor] = useState('')
  const [deliveryApartment, setDeliveryApartment] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRegion, setSelectedRegion] = useState('')
  const [itemType, setItemType] = useState<'documents' | 'parcel' | 'flowers' | 'food' | 'other'>('flowers')
  const [canEdit, setCanEdit] = useState(false)

  const loadData = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    
    try {
      // Загружаем заказ
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError) {
        setError('Заказ не найден')
        setLoadingData(false)
        return
      }

      // Проверяем, что заказ принадлежит пользователю
      if (order.customer_id !== user.id && order.client_id !== user.id) {
        setError('У вас нет прав на редактирование этого заказа')
        setLoadingData(false)
        return
      }

      // Проверяем, что заказ можно редактировать (статус searching_courier и нет executor_user_id)
      if (order.status !== 'searching_courier' || order.executor_user_id !== null) {
        setError('Этот заказ нельзя редактировать. Водитель уже принял заказ.')
        setCanEdit(false)
        setLoadingData(false)
        return
      }

      setCanEdit(true)
      
      // Заполняем форму данными заказа
      setPickupAddress(order.pickup_address || '')
      setDeliveryAddress(order.delivery_address || '')
      setPickupEntrance(order.pickup_entrance || '')
      setPickupFloor(order.pickup_floor || '')
      setPickupApartment(order.pickup_apartment || '')
      setDeliveryEntrance(order.delivery_entrance || '')
      setDeliveryFloor(order.delivery_floor || '')
      setDeliveryApartment(order.delivery_apartment || '')
      setDescription(order.description || '')
      setSelectedRegion(order.region_id || '')
      setItemType(order.item_type || 'flowers')

      // Загружаем регионы
      let { data: regionsData, error: regionsError } = await supabase
        .rpc('get_all_regions')

      if (regionsError || !regionsData) {
        const result = await supabase
          .from('regions')
          .select('*')
          .eq('is_active', true)
          .order('name')
        
        regionsData = result.data
        regionsError = result.error
      }

      if (regionsError) {
        console.error('Ошибка загрузки регионов:', regionsError)
      } else if (regionsData) {
        const activeRegions = regionsData.filter((r: Region) => r.is_active !== false)
        setRegions(activeRegions)
      }
    } catch (err: any) {
      console.error('Ошибка загрузки данных:', err)
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      setLoadingData(false)
    }
  }, [orderId, supabase, router])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Валидация
      if (!selectedRegion || selectedRegion === '') {
        setError('Пожалуйста, выберите регион')
        setLoading(false)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Пользователь не авторизован')
        setLoading(false)
        return
      }

      // Получаем координаты адресов (упрощенная версия)
      const pickupCoords = { lat: 53.9045, lon: 27.5615 }
      const deliveryCoords = { lat: 53.9045, lon: 27.5615 }

      // Получаем базовую цену региона
      const selectedRegionData = regions.find(r => r.id === selectedRegion)
      
      if (!selectedRegionData) {
        setError('Выбранный регион не найден')
        setLoading(false)
        return
      }

      const basePrice = selectedRegionData.base_price

      // Обновляем заказ
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          pickup_address: pickupAddress,
          pickup_coordinates: `(${pickupCoords.lon},${pickupCoords.lat})`,
          delivery_address: deliveryAddress,
          delivery_coordinates: `(${deliveryCoords.lon},${deliveryCoords.lat})`,
          description: description,
          region_id: selectedRegion,
          base_price: basePrice,
          final_price: basePrice,
          item_type: itemType,
        })
        .eq('id', orderId)

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      // Успешно обновлен заказ
      router.push('/dashboard/client/orders')
    } catch (err: any) {
      setError(err.message || 'Ошибка обновления заказа')
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="pb-20">
        <div className="text-center py-8 text-gray-400">Загрузка...</div>
        <ClientBottomNavigation />
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="pb-20">
        <h1 className="text-3xl font-bold mb-6 text-white">Редактировать заказ</h1>
        <div className="bg-gray-800 rounded-lg shadow p-6">
          {error && (
            <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded border border-red-800 mb-4">
              {error}
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard/client/orders')}
            className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Вернуться к заказам
          </button>
        </div>
        <ClientBottomNavigation />
      </div>
    )
  }

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6 text-white">Редактировать заказ</h1>

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
            disabled={regions.length === 0}
            className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {regions.length === 0 ? (
              <option value="" className="bg-gray-700">Загрузка регионов...</option>
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboard/client/orders')}
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-600"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Сохранение...' : 'Сохранить изменения'}
          </button>
        </div>
      </form>

      <ClientBottomNavigation />
    </div>
  )
}

