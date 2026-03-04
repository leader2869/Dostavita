import { NextRequest } from 'next/server'
import { apiSuccess, apiError, maskInternalMessage } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/** Nominatim: 1 запрос в секунду на IP */
const NOMINATIM_WINDOW_MS = 1100
const NOMINATIM_MAX_REQUESTS = 1

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(`nominatim:${ip}`, { windowMs: NOMINATIM_WINDOW_MS, maxRequests: NOMINATIM_MAX_REQUESTS })) {
    return apiError('Слишком частые запросы. Подождите секунду.', 429)
  }

  try {
    const searchString = request.nextUrl.search
    if (!searchString) return apiError('Поисковый запрос обязателен', 400)

    const urlMatch = searchString.match(/[?&]q=([^&]*)/)
    if (!urlMatch || !urlMatch[1]) return apiError('Поисковый запрос обязателен', 400)

    // Параметр уже закодирован в URL, декодируем его
    let query: string
    try {
      query = decodeURIComponent(urlMatch[1])
    } catch (e) {
      console.error('Ошибка декодирования query:', e)
      // Если декодирование не удалось, используем как есть
      query = urlMatch[1]
    }

    query = query.trim()

    if (query.length === 0) return apiError('Поисковый запрос обязателен', 400)

    // Правильно кодируем запрос для UTF-8 для Nominatim API
    const encodedQuery = encodeURIComponent(query)

    // Nominatim требует указания User-Agent
    // accept-language=ru для получения адресов на русском языке
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=10&addressdetails=1&countrycodes=by&accept-language=ru`
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Prosto Delivery App (contact@prosto.of.by)',
        'Accept-Language': 'ru',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Nominatim API error:', response.status, response.statusText, errorText)
      throw new Error(`Nominatim API error: ${response.statusText}`)
    }

    const data = await response.json()

    // Форматируем результаты для удобства использования
    const results = data.map((item: any) => {
      // Формируем адрес с областью, но без района и индекса
      const addr = item.address || {}
      const addressParts: string[] = []
      
      // Добавляем компоненты адреса в нужном порядке
      if (addr.house_number && addr.road) {
        addressParts.push(`${addr.road}, ${addr.house_number}`)
      } else if (addr.road) {
        addressParts.push(addr.road)
      } else if (addr.house_number) {
        addressParts.push(addr.house_number)
      }
      
      if (addr.city || addr.town || addr.village) {
        addressParts.push(addr.city || addr.town || addr.village)
      }
      
      // Добавляем область (state), но не район (county)
      if (addr.state) {
        addressParts.push(addr.state)
      }
      
      // Если нет деталей адреса, используем оригинальный display_name, но убираем индекс и район
      const formattedAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : item.display_name
            .replace(/,\s*\d{6}(-\d{4})?/g, '') // Убираем индекс
            .replace(/,\s*[А-Яа-яЁё\s]+ район/g, '') // Убираем район
            .trim()
      
      return {
        display_name: formattedAddress,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        address: addr,
      }
    })

    return apiSuccess({ results })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Ошибка поиска адреса'
    console.error('Ошибка поиска адреса через Nominatim:', error)
    return apiError(maskInternalMessage(message), 500)
  }
}

