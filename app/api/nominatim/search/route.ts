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
    const results = data.map((item: any) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      address: item.address || {},
    }))

    return NextResponse.json({ results })
  } catch (error: any) {
    console.error('Ошибка поиска адреса через Nominatim:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка поиска адреса' },
      { status: 500 }
    )
  }
}

