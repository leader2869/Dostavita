/**
 * Форматирует время готовности заказа с указанием времени до/после готовности
 * @param readyAt - ISO строка времени готовности заказа
 * @returns Объект с отформатированным временем, текстом о времени до/после готовности и типом статуса
 */
export function formatReadyTime(readyAt: string): {
  formattedTime: string
  timeStatus: string | null
  statusType: 'waiting' | 'upcoming' | null // 'waiting' - ожидает (красный), 'upcoming' - будет готов (желтый)
} {
  const readyDate = new Date(readyAt)
  const now = new Date()
  
  // Форматируем время готовности
  const formattedTime = readyDate.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  
  // Вычисляем разницу в минутах
  const diffMinutes = Math.round((readyDate.getTime() - now.getTime()) / (1000 * 60))
  
  let timeStatus: string | null = null
  let statusType: 'waiting' | 'upcoming' | null = null
  
  // Функция для определения склонения минут
  const getMinutesText = (num: number): string => {
    const lastDigit = num % 10
    const lastTwoDigits = num % 100
    
    // Исключение: 11, 12, 13, 14 → минут
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return 'минут'
    }
    
    // Если последняя цифра 1, 2, 3, 4 → минуты
    if (lastDigit >= 1 && lastDigit <= 4) {
      return 'минуты'
    }
    
    // Иначе → минут
    return 'минут'
  }

  if (diffMinutes > 0) {
    // Заказ будет готов в будущем (желтый)
    statusType = 'upcoming'
    const hours = Math.floor(diffMinutes / 60)
    const minutes = diffMinutes % 60
    
    if (hours > 0) {
      const hoursText = hours === 1 ? 'час' : (hours >= 2 && hours <= 4 ? 'часа' : 'часов')
      if (minutes > 0) {
        const minutesText = getMinutesText(minutes)
        timeStatus = `Заказ будет готов через ${hours} ${hoursText} ${minutes} ${minutesText}`
      } else {
        timeStatus = `Заказ будет готов через ${hours} ${hoursText}`
      }
    } else {
      const minutesText = getMinutesText(minutes)
      timeStatus = `Заказ будет готов через ${minutes} ${minutesText}`
    }
  } else if (diffMinutes < 0) {
    // Заказ уже должен быть готов (ожидает) - красный
    statusType = 'waiting'
    const waitMinutes = Math.abs(diffMinutes)
    const hours = Math.floor(waitMinutes / 60)
    const minutes = waitMinutes % 60
    
    if (hours > 0) {
      const hoursText = hours === 1 ? 'час' : (hours >= 2 && hours <= 4 ? 'часа' : 'часов')
      if (minutes > 0) {
        const minutesText = getMinutesText(minutes)
        timeStatus = `Заказ ожидает ${hours} ${hoursText} ${minutes} ${minutesText}`
      } else {
        timeStatus = `Заказ ожидает ${hours} ${hoursText}`
      }
    } else {
      const minutesText = getMinutesText(waitMinutes)
      timeStatus = `Заказ ожидает ${waitMinutes} ${minutesText}`
    }
  }
  // Если diffMinutes === 0, timeStatus остается null (заказ готов сейчас)
  
  return {
    formattedTime,
    timeStatus,
    statusType
  }
}

