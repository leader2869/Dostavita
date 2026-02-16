import { NextRequest, NextResponse } from 'next/server'

// Отключаем статическую генерацию, так как используем request.nextUrl
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const lat = searchParams.get('lat')
  const lon = searchParams.get('lon')

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Требуются параметры lat и lon' }, { status: 400 })
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'Dostavita Delivery Service',
        },
      }
    )

    if (!response.ok) {
      throw new Error('Ошибка запроса к Nominatim')
    }

    const data = await response.json()

    if (!data || !data.display_name) {
      return NextResponse.json({ error: 'Адрес не найден' }, { status: 404 })
    }

    // Форматируем адрес: убираем район и почтовый индекс
    const parts = data.display_name.split(',')
    const filteredParts = parts.filter(
      (part: string) =>
        !part.includes('район') &&
        !part.includes('Район') &&
        !/\d{6}/.test(part.trim()) // Убираем почтовые индексы
    )
    const formattedAddress = filteredParts.join(',').trim()

    return NextResponse.json({
      address: formattedAddress,
      fullAddress: data.display_name,
      addressDetails: data.address,
    })
  } catch (error) {
    console.error('Ошибка обратного геокодинга:', error)
    return NextResponse.json(
      { error: 'Ошибка получения адреса' },
      { status: 500 }
    )
  }
}

