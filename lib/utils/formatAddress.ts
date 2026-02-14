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

