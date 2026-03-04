import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const NOMINATIM_WINDOW_MS = 1100
const NOMINATIM_MAX_REQUESTS = 1

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  if (!checkRateLimit(`nominatim-reverse:${ip}`, { windowMs: NOMINATIM_WINDOW_MS, maxRequests: NOMINATIM_MAX_REQUESTS })) {
    return apiError('Слишком частые запросы. Подождите секунду.', 429)
  }

  const searchParams = request.nextUrl.searchParams
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) return apiError('Требуются параметры lat и lon', 400)

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Prosto Delivery Service',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Ошибка запроса к Nominatim')
    }

    const data = await response.json()

    if (!data || !data.display_name) return apiError('Адрес не найден', 404)

    const parts = data.display_name.split(',')
    const filteredParts = parts.filter(
      (part: string) =>
        !part.includes('район') &&
        !part.includes('Район') &&
        !/\d{6}/.test(part.trim())
    )
    const formattedAddress = filteredParts.join(',').trim()

    return apiSuccess({
      address: formattedAddress,
      fullAddress: data.display_name,
      addressDetails: data.address,
    })
  } catch (error) {
    console.error('Ошибка обратного геокодинга:', error)
    return apiError('Ошибка получения адреса', 500)
  }
}

