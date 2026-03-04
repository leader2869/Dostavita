const STATUS_LABELS: Record<string, string> = {
  searching_courier: 'Ищем курьера',
  courier_accepted: 'Курьер принял заказ',
  courier_coming: 'Курьер едет к отправителю',
  courier_delivering: 'Курьер едет к получателю',
  completed: 'Заказ завершен',
  cancelled: 'Отменен',
}

const STATUS_COLORS: Record<string, string> = {
  searching_courier: 'text-yellow-400 bg-yellow-400/20 border-yellow-400/50',
  courier_accepted: 'text-orange-400 bg-orange-400/20 border-orange-400/50',
  courier_coming: 'text-blue-400 bg-blue-400/20 border-blue-400/50',
  courier_delivering: 'text-purple-400 bg-purple-400/20 border-purple-400/50',
  completed: 'text-brand-light bg-brand-light/20 border-green-400/50',
  cancelled: 'text-red-400 bg-red-400/20 border-red-400/50',
}

export function getOrderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

export function getOrderStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? 'text-gray-600 bg-gray-400/20 border-gray-400/50'
}

const ACTIVE_STATUSES: Set<string> = new Set([
  'searching_courier',
  'courier_accepted',
  'courier_coming',
  'courier_delivering',
])

export function isActiveOrderStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status)
}

/** Hex-цвет для маркеров на карте (Leaflet и т.п.) */
const STATUS_HEX: Record<string, string> = {
  searching_courier: '#fbbf24',
  courier_accepted: '#fb923c',
  courier_coming: '#3b82f6',
  courier_delivering: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
}

export function getOrderStatusColorHex(status: string): string {
  return STATUS_HEX[status] ?? '#6b7280'
}
