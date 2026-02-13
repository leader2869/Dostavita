// Типы для приложения Dostavita

export type UserRole =
  | 'customer' // Организация
  | 'client' // Клиент-получатель
  | 'driver' // Исполнитель (водитель)
  | 'fleet' // Автопарк
  | 'admin' // Администратор
  | 'superadmin' // Суперадмин

export type OrderStatus =
  | 'searching_courier' // Ищем курьера
  | 'courier_coming' // Курьер едет к вам
  | 'courier_delivering' // Курьер доставляет заказ
  | 'completed' // Заказ завершен
  | 'cancelled' // Отменен

export type OrderVisibility = 'public' | 'assigned'

export interface User {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  role: UserRole
  avatar_url: string | null
  vehicle_type: string | null
  vehicle_number: string | null
  license_number: string | null
  created_at: string
  updated_at: string
}

export interface Region {
  id: string
  name: string
  base_price: number
  is_active: boolean
  created_at: string
}

export interface Driver {
  id: string
  user_id: string
  vehicle_type: string
  vehicle_number: string | null
  license_number: string
  fleet_id: string | null
  is_available: boolean
  current_location: {
    lat: number
    lng: number
  } | null
  rating: number
  total_orders: number
  shift_status: 'offline' | 'online' | 'break' | 'shift_closed'
  shift_started_at: string | null
  shift_ended_at: string | null
  created_at: string
}

export interface Order {
  id: string
  customer_id: string
  client_id: string | null
  driver_id: string | null
  executor_user_id: string | null
  status: OrderStatus
  visibility: OrderVisibility
  pickup_address: string
  pickup_coordinates: {
    lat: number
    lng: number
  }
  pickup_entrance: string | null
  pickup_floor: string | null
  pickup_apartment: string | null
  delivery_address: string
  delivery_coordinates: {
    lat: number
    lng: number
  }
  delivery_entrance: string | null
  delivery_floor: string | null
  delivery_apartment: string | null
  description: string | null
  weight: number | null
  volume: number | null
  item_type: 'documents' | 'parcel' | 'flowers' | 'food' | 'other' | null
  courier_comment: string | null
  base_price: number
  region_id: string
  final_price: number
  is_paid: boolean
  created_at: string
  accepted_at: string | null
  picked_up_at: string | null
  started_delivery_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface Balance {
  id: string
  user_id: string
  amount: number
  currency: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  order_id: string | null
  amount: number
  type: 'credit' | 'debit'
  description: string
  created_at: string
}
