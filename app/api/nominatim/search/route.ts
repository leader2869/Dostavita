import { NextResponse } from 'next/server'

// Отключаем статическую генерацию, так как используем request.url
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Поисковый запрос обязателен' },
        { status: 400 }
      )
    }

    // Nominatim требует указания User-Agent
    // accept-language=ru для получения адресов на русском языке
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&countrycodes=by&accept-language=ru`,
      {
        headers: {
          'User-Agent': 'Просто! Delivery App (contact@prosto.of.by)',
          'Accept-Language': 'ru',
        },
      }
    )

    if (!response.ok) {
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

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Ошибка поиска адреса через Nominatim:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка поиска адреса' },
      { status: 500 }
    )
  }
}

