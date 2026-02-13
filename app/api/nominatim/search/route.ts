import { NextResponse } from 'next/server'

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
          'User-Agent': 'Dostavita Delivery App (contact@dostavita.by)',
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
      // Формируем адрес без области и индекса
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
      
      // Если нет деталей адреса, используем оригинальный display_name, но убираем индекс
      const formattedAddress = addressParts.length > 0 
        ? addressParts.join(', ')
        : item.display_name.replace(/,\s*\d{6}(-\d{4})?/g, '').replace(/,\s*[А-Яа-яЁё\s]+ область/g, '').trim()
      
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

