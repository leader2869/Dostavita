// Константы приложения

/** Максимальный размер файла аватара в байтах (5 MB) */
export const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

/** Максимальный размер файла в чате (5 MB) */
export const MAX_CHAT_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

export const ORDER_STATUS_LABELS = {
  searching_courier: 'Ищем курьера',
  courier_accepted: 'Курьер принял заказ',
  courier_coming: 'Курьер едет к отправителю',
  courier_delivering: 'Курьер едет к получателю',
  completed: 'Заказ завершен',
  cancelled: 'Отменен',
} as const

export const ROLE_LABELS = {
  customer: 'Организация',
  client: 'Клиент',
  driver: 'Исполнитель',
  fleet: 'Автопарк',
  admin: 'Администратор',
  superadmin: 'Суперадмин',
} as const

export const ORDER_VISIBILITY_LABELS = {
  public: 'Общий доступ',
  assigned: 'Назначенный',
} as const

