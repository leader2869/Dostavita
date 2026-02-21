import { NextRequest, NextResponse } from 'next/server'

// Отключаем статическую генерацию, так как используем request.url
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Используем search string напрямую, избегая создания URL объекта
    const searchString = request.nextUrl.search
    
    if (!searchString) {
      return NextResponse.json(
        { error: 'Поисковый запрос обязателен' },
        { status: 400 }
      )
    }

    // Извлекаем параметр q из query string вручную
    const urlMatch = searchString.match(/[?&]q=([^&]*)/)
    
    if (!urlMatch || !urlMatch[1]) {
      return NextResponse.json(
        { error: 'Поисковый запрос обязателен' },
        { status: 400 }
      )
    }

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

    if (query.length === 0) {
      return NextResponse.json(
        { error: 'Поисковый запрос обязателен' },
        { status: 400 }
      )
    }

    // Правильно кодируем запрос для UTF-8 для Nominatim API
    const encodedQuery = encodeURIComponent(query)

    // Nominatim требует указания User-Agent
    // accept-language=ru для получения адресов на русском языке
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=10&addressdetails=1&countrycodes=by&accept-language=ru`
    
    console.log('🔍 Nominatim search request:', nominatimUrl)
    console.log('🔍 Original query:', query)
    console.log('🔍 Encoded query:', encodedQuery)
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'Prosto Delivery App (contact@prosto.of.by)',
        'Accept-Language': 'ru',
      },
    })

    console.log('📡 Nominatim response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Nominatim API error:', response.status, response.statusText, errorText)
      throw new Error(`Nominatim API error: ${response.statusText}`)
    }

    const data = await response.json()
    console.log('✅ Nominatim results count:', data?.length || 0)

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

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Ошибка поиска адреса через Nominatim:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка поиска адреса' },
      { status: 500 }
    )
  }
}

