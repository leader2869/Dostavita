'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { ClientBottomNavigation } from '@/components/client/ClientBottomNavigation'
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete'
import type { Region } from '@/lib/types'
import { formatAddressForCard } from '@/lib/utils/formatAddress'

interface SavedAddress {
  id: string
  address_type: 'pickup' | 'delivery' | 'both'
  label: string
  address: string
  coordinates: any
  region_id: string | null
  region_name?: string | null
  entrance?: string | null
  floor?: string | null
  apartment?: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

export default function SavedAddressesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [regions, setRegions] = useState<Region[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null)

  // Форма добавления/редактирования адреса
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

  const loadAddresses = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: addressesData, error: addressesError } = await supabase
        .rpc('get_user_saved_addresses', { user_uuid: user.id })

      if (addressesError) {
        console.error('Ошибка загрузки адресов:', addressesError)
        setError('Ошибка загрузки адресов')
      } else {
        console.log('Загруженные адреса:', addressesData)
        // Убеждаемся, что поля entrance, floor, apartment присутствуют
        const addressesWithDetails = (addressesData || []).map((addr: any) => ({
          ...addr,
          entrance: addr.entrance || null,
          floor: addr.floor || null,
          apartment: addr.apartment || null,
        }))
        console.log('Адреса с деталями:', addressesWithDetails)
        setAddresses(addressesWithDetails)
      }
    } catch (err: any) {
      console.error('Ошибка загрузки адресов:', err)
      setError(err.message || 'Ошибка загрузки адресов')
    } finally {
      setLoading(false)
    }
  }, [supabase, router])

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

  useEffect(() => {
    loadAddresses()
    loadRegions()
  }, [loadAddresses, loadRegions])

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
      // Для GEOGRAPHY(Point, 4326) используем формат WKT: POINT(lon lat)
      // Supabase автоматически конвертирует строку в GEOGRAPHY
      const point = `POINT(${coords.lon} ${coords.lat})`

      if (editingAddress) {
        // Обновление существующего адреса
        const { error: updateError } = await supabase
          .from('saved_addresses')
          .update({
            label,
            address,
            coordinates: point,
            address_type: addressType,
            region_id: selectedRegion || null,
            entrance: entrance || null,
            floor: floor || null,
            apartment: apartment || null,
            is_default: isDefault,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingAddress.id)

        if (updateError) throw updateError
      } else {
        // Создание нового адреса
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
      }

      await loadAddresses()
      setShowAddModal(false)
      setEditingAddress(null)
      setLabel('')
      setAddress('')
      setCoordinates(undefined)
      setAddressType('both')
      setSelectedRegion('')
      setEntrance('')
      setFloor('')
      setApartment('')
      setIsDefault(false)
    } catch (err: any) {
      console.error('Ошибка сохранения адреса:', err)
      setError(err.message || 'Ошибка сохранения адреса')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (addr: SavedAddress) => {
    setEditingAddress(addr)
    setLabel(addr.label)
    setAddress(addr.address)
    setAddressType(addr.address_type)
    setSelectedRegion(addr.region_id || '')
    setEntrance(addr.entrance || '')
    setFloor(addr.floor || '')
    setApartment(addr.apartment || '')
    setIsDefault(addr.is_default)
    
    // Парсим координаты если они есть
    if (addr.coordinates) {
      try {
        const coords = JSON.parse(addr.coordinates)
        if (coords.coordinates && coords.coordinates.length === 2) {
          setCoordinates({ lat: coords.coordinates[1], lon: coords.coordinates[0] })
        }
      } catch (e) {
        console.error('Ошибка парсинга координат:', e)
      }
    }
    
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот адрес?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('saved_addresses')
        .delete()
        .eq('id', id)

      if (error) throw error

      await loadAddresses()
    } catch (err: any) {
      console.error('Ошибка удаления адреса:', err)
      setError(err.message || 'Ошибка удаления адреса')
    }
  }

  const getAddressTypeLabel = (type: string) => {
    switch (type) {
      case 'pickup': return 'Отправление'
      case 'delivery': return 'Доставка'
      case 'both': return 'Оба'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="pb-20">
        <BackButton />
        <h1 className="text-3xl font-bold mb-6 text-white">Мои адреса</h1>
        <p className="text-gray-400">Загрузка...</p>
        <ClientBottomNavigation />
      </div>
    )
  }

  return (
    <div className="pb-20">
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Мои адреса</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition border border-gray-700 hover:border-green-500 flex flex-col h-full min-h-[200px]"
          >
            <div 
              onClick={() => handleEdit(addr)}
              className="flex-1 cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-base font-semibold text-white flex-1">{addr.label}</h3>
                {addr.is_default && (
                  <span className="px-1.5 py-0.5 bg-green-600 text-white text-xs rounded">
                    По умолчанию
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-1 line-clamp-3">
                {formatAddressForCard(addr.address, addr.entrance, addr.floor, addr.apartment)}
              </p>
              {addr.address_type !== 'both' && (
                <div className="flex gap-1 mt-2">
                  <span className="px-1.5 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">
                    {getAddressTypeLabel(addr.address_type)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-1 mt-auto pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(addr)
                }}
                className="flex-1 bg-blue-600 text-white px-2 py-1 rounded text-xs hover:bg-blue-700 transition"
              >
                Редактировать
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(addr.id)
                }}
                className="flex-1 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        
        {/* Квадратик для добавления нового адреса */}
        <div
          onClick={() => {
            setEditingAddress(null)
            setLabel('')
            setAddress('')
            setCoordinates(undefined)
            setAddressType('both')
            setSelectedRegion('')
            setEntrance('')
            setFloor('')
            setApartment('')
            setIsDefault(false)
            setShowAddModal(true)
          }}
          className="bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:bg-gray-700 transition border-2 border-dashed border-gray-600 hover:border-green-500 flex flex-col items-center justify-center min-h-[120px]"
        >
          <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <p className="text-sm text-gray-400 font-medium">Добавить адрес</p>
        </div>
      </div>

      {/* Модальное окно для добавления/редактирования адреса */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-gray-800 rounded-t-lg sm:rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] sm:max-h-[90vh] h-[90vh] sm:h-auto flex flex-col">
            <form onSubmit={handleSaveAddress} className="flex flex-col flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">
                  {editingAddress ? 'Редактировать адрес' : 'Добавить адрес'}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingAddress(null)
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
                  <label htmlFor="address" className="block text-sm font-medium text-gray-300 mb-1">
                    Адрес *
                  </label>
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
                        placeholder="5"
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

              <div className="flex justify-end gap-4 mt-6 pt-4 border-t border-gray-700 sticky bottom-0 bg-gray-800 pb-4 sm:pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setEditingAddress(null)
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
                  {saving ? 'Сохранение...' : editingAddress ? 'Сохранить изменения' : 'Сохранить адрес'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ClientBottomNavigation />
    </div>
  )
}

