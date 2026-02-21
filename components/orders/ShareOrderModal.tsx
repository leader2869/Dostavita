'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatAddressForOrder } from '@/lib/utils/formatAddress'

interface ShareOrderModalProps {
  order: any
  isOpen: boolean
  onClose: () => void
}

export function ShareOrderModal({ order, isOpen, onClose }: ShareOrderModalProps) {
  const [shareType, setShareType] = useState<'full' | 'driver'>('full')
  const [driverInfo, setDriverInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const loadDriverInfo = useCallback(async () => {
    if (!order?.executor_user_id) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', order.executor_user_id)
        .single()

      if (!error && data) {
        setDriverInfo(data)
      }
    } catch (err) {
      console.error('Ошибка загрузки информации о водителе:', err)
    } finally {
      setLoading(false)
    }
  }, [order?.executor_user_id, supabase])

  useEffect(() => {
    if (isOpen && order?.executor_user_id && shareType === 'driver') {
      loadDriverInfo()
    } else if (isOpen && shareType === 'full' && order?.executor_user_id) {
      loadDriverInfo()
    }
  }, [isOpen, order, shareType, loadDriverInfo])

  const formatShareText = () => {
    if (shareType === 'full') {
      // Вся информация по заказу
      let text = `📦 Заказ №${order.order_number || order.id.slice(0, 8)}\n\n`
      
      // Информация о водителе в самом начале
      if (order.executor_user_id && driverInfo) {
        text += `👤 Информация о водителе:\n`
        if (driverInfo.full_name) {
          text += `Имя: ${driverInfo.full_name}\n`
        }
        if (driverInfo.phone) {
          text += `Телефон: ${driverInfo.phone}\n`
        }
        if (driverInfo.vehicle_brand || driverInfo.vehicle_model || driverInfo.vehicle_number) {
          text += `🚗 Транспорт:\n`
          if (driverInfo.vehicle_brand) text += `Марка: ${driverInfo.vehicle_brand}\n`
          if (driverInfo.vehicle_model) text += `Модель: ${driverInfo.vehicle_model}\n`
          if (driverInfo.vehicle_number) text += `Номер: ${driverInfo.vehicle_number}\n`
        }
        text += `\n`
      }
      
      text += `📍 Точка А (откуда):\n${formatAddressForOrder(order.pickup_address)}\n\n`
      text += `📍 Точка Б (куда):\n${formatAddressForOrder(order.delivery_address)}\n\n`
      
      if (order.sender_phone) {
        text += `📞 Телефон отправителя: ${order.sender_phone}\n`
      }
      if (order.recipient_phone) {
        text += `📞 Телефон получателя: ${order.recipient_phone}\n`
      }
      
      text += `\n💰 Стоимость доставки: ${order.final_price} BYN\n`
      
      if (order.item_type) {
        text += `📦 Тип товара: ${order.item_type}\n`
      }
      if (order.description) {
        text += `📝 Описание: ${order.description}\n`
      }
      
      if (order.ready_at) {
        const readyDate = new Date(order.ready_at)
        text += `\n⏰ Заказ будет готов к выдаче: ${readyDate.toLocaleString('ru-RU')}\n`
      }
      
      return text
    } else {
      // Информация водителя
      if (!driverInfo) {
        return 'Информация о водителе загружается...'
      }
      
      let text = `👤 Информация о водителе\n\n`
      text += `Имя: ${driverInfo.full_name || 'не указано'}\n`
      text += `Телефон: ${driverInfo.phone || 'не указан'}\n`
      
      if (driverInfo) {
        text += `\n🚗 Информация по транспорту:\n`
        if (driverInfo.vehicle_brand) text += `Марка: ${driverInfo.vehicle_brand}\n`
        if (driverInfo.vehicle_model) text += `Модель: ${driverInfo.vehicle_model}\n`
        if (driverInfo.vehicle_type) text += `Тип: ${driverInfo.vehicle_type}\n`
        if (driverInfo.vehicle_number) text += `Номер: ${driverInfo.vehicle_number}\n`
      }
      
      return text
    }
  }

  const shareToTelegram = () => {
    const text = encodeURIComponent(formatShareText())
    window.open(`https://t.me/share/url?url=&text=${text}`, '_blank')
  }

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(formatShareText())
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const shareToSMS = () => {
    const text = encodeURIComponent(formatShareText())
    window.open(`sms:?body=${text}`, '_blank')
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formatShareText())
      alert('Текст скопирован в буфер обмена!')
    } catch (err) {
      console.error('Ошибка копирования:', err)
      alert('Не удалось скопировать текст')
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Поделиться заказом</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Выбор типа шаринга */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Чем поделиться:
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setShareType('full')}
                className={`flex-1 px-4 py-2 rounded-md transition ${
                  shareType === 'full'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Всей информацией по заказу
              </button>
              <button
                onClick={() => setShareType('driver')}
                className={`flex-1 px-4 py-2 rounded-md transition ${
                  shareType === 'driver'
                    ? 'bg-brand-light text-gray-900'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={!order?.executor_user_id}
              >
                Информацией водителя
              </button>
            </div>
            {!order?.executor_user_id && shareType === 'driver' && (
              <p className="text-xs text-gray-500 mt-2">
                Водитель еще не назначен на заказ
              </p>
            )}
          </div>

          {/* Предпросмотр текста */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Предпросмотр:
            </label>
            <div className="bg-gray-50 rounded-md p-4 max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-900 font-sans">
                {loading ? 'Загрузка...' : formatShareText()}
              </pre>
            </div>
          </div>

          {/* Кнопки шаринга */}
          <div className="space-y-2">
            <button
              onClick={shareToTelegram}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-md transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.329-.913.489-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
              </svg>
              Поделиться в Telegram
            </button>
            <button
              onClick={shareToWhatsApp}
              className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-3 rounded-md transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-.923-4.236-1.893-7.06-4.63-7.783-5.41-.723-.78-1.022-1.164-.114-1.896.912-.73 1.164-1.193 1.758-1.788.594-.595.148-1.193-.074-1.788-.223-.595-1.986-2.38-2.72-3.264-.733-.884-1.49-.148-2.01.074-.52.223-1.49.74-1.49 1.787 0 1.046 1.49 2.38 1.698 2.58.208.198 2.938 4.48 7.11 6.28 4.17 1.8 4.17 1.8 4.94 1.89.77.09 1.49-.148 1.698-.74.208-.59.208-1.193.148-1.788-.06-.595-.297-.99-.594-1.39z"/>
              </svg>
              Поделиться в WhatsApp
            </button>
            <button
              onClick={shareToSMS}
              className="w-full bg-blue-400 hover:bg-blue-500 text-white px-4 py-3 rounded-md transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Отправить SMS
            </button>
            <button
              onClick={copyToClipboard}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 px-4 py-3 rounded-md transition flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Копировать текст
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

