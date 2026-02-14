/**
 * Форматирует адрес для отображения в карточке
 * Формат: город, улица, дом, корпус (при наличии), квартира (при наличии), подъезд (при наличии), этаж (при наличии)
 * Без области
 */
export function formatAddressForCard(
  fullAddress: string,
  entrance?: string | null,
  floor?: string | null,
  apartment?: string | null
): string {
  if (!fullAddress) return ''

  // Удаляем область из адреса
  let address = fullAddress
    .replace(/,\s*[А-ЯЁ][а-яё]*\s*область/gi, '') // Удаляем "область"
    .replace(/,\s*область/gi, '') // Удаляем просто "область"
    .replace(/,\s*Беларусь/gi, '') // Удаляем "Беларусь"
    .replace(/,\s*Belarus/gi, '') // Удаляем "Belarus"
    .trim()

  // Удаляем лишние запятые
  address = address.replace(/,\s*,/g, ',').replace(/^,\s*/, '').replace(/,\s*$/, '')

  // Создаем массив частей адреса
  const parts: string[] = []

  // Разбиваем адрес на части по запятым
  const addressParts = address.split(',').map(p => p.trim()).filter(p => p)

  // Добавляем части адреса (город, улица, дом, корпус)
  if (addressParts.length > 0) {
    parts.push(...addressParts)
  }

  // Добавляем корпус, если он есть в адресе (обычно в скобках или после "корп.")
  // Но так как у нас нет отдельного поля для корпуса, пропускаем это

  // Добавляем квартиру (если есть)
  if (apartment) {
    parts.push(`кв. ${apartment}`)
  }

  // Добавляем подъезд (если есть)
  if (entrance) {
    parts.push(`подъезд ${entrance}`)
  }

  // Добавляем этаж (если есть)
  if (floor) {
    parts.push(`этаж ${floor}`)
  }

  return parts.join(', ')
}

/**
 * Форматирует адрес для отображения в заказах
 * Формат: город, улица, дом
 * Без области
 * Пример: "проспект Фрунзе, 55, Витебск, Витебская область" -> "Витебск, проспект Фрунзе, 55"
 */
export function formatAddressForOrder(fullAddress: string): string {
  if (!fullAddress) return ''

  // Разбиваем адрес на части
  const parts = fullAddress.split(',').map(p => p.trim()).filter(p => p)
  
  if (parts.length === 0) return fullAddress

  // Удаляем область и страну
  const filteredParts = parts.filter(part => {
    const lower = part.toLowerCase()
    return !lower.includes('область') && 
           !lower.includes('беларусь') && 
           !lower.includes('belarus') &&
           !lower.includes('республика')
  })

  if (filteredParts.length === 0) return fullAddress

  // Ищем город (обычно это последняя часть перед областью, или часть с названием города)
  // Города обычно: Минск, Витебск, Гродно, Брест, Гомель, Могилёв
  const cityPattern = /^(минск|витебск|гродно|брест|гомель|могилёв|могилев)$/i
  let cityIndex = -1
  let city = ''

  // Ищем город с конца (обычно он ближе к концу)
  for (let i = filteredParts.length - 1; i >= 0; i--) {
    if (cityPattern.test(filteredParts[i])) {
      city = filteredParts[i]
      cityIndex = i
      break
    }
  }

  // Если город найден, формируем: город, остальные части
  if (cityIndex >= 0) {
    const beforeCity = filteredParts.slice(0, cityIndex)
    const afterCity = filteredParts.slice(cityIndex + 1)
    const remaining = [...beforeCity, ...afterCity].join(', ')
    return `${city}, ${remaining}`
  }

  // Если города нет, возвращаем как есть, но без области
  return filteredParts.join(', ')
}

