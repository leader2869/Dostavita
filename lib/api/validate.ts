import { z } from 'zod'
import { NextResponse } from 'next/server'

/**
 * Парсит body запроса по Zod-схеме. При ошибке возвращает NextResponse с 400.
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Некорректное тело запроса (JSON)' },
        { status: 400 }
      ),
    }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    const first = result.error.flatten().fieldErrors
    const message =
      typeof first === 'object' && first && Object.keys(first).length > 0
        ? Object.values(first).flat().filter(Boolean)[0] ?? 'Ошибка валидации'
        : result.error.message || 'Ошибка валидации'
    return {
      ok: false,
      response: NextResponse.json(
        { error: typeof message === 'string' ? message : 'Ошибка валидации' },
        { status: 400 }
      ),
    }
  }
  return { ok: true, data: result.data }
}

/** Параметры маршрута [id] */
export const paramsIdSchema = z.object({ id: z.string().min(1, 'ID обязателен') })

/** Query: q для nominatim */
export const querySearchSchema = z.object({
  q: z.string().min(1, 'Поисковый запрос обязателен'),
})

/** Создание водителя (customer) */
export const createDriverSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(6, 'Пароль не менее 6 символов'),
  full_name: z.string().min(1, 'Имя обязательно'),
  phone: z.string().optional(),
  vehicle_type: z.string().min(1, 'Тип транспорта обязателен'),
  vehicle_brand: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_number: z.string().optional(),
  license_number: z.string().min(1, 'Номер удостоверения обязателен'),
})

/** Привязка водителя — отправка запроса */
export const attachDriverSchema = z.object({
  driver_user_id: z.string().uuid('Некорректный ID водителя'),
  message: z.string().optional(),
})

/** Отмена заказа: только id в params */
/** Ответ на запрос организации (driver) */
export const respondToRequestSchema = z.object({
  response: z.enum(['accepted', 'rejected'], {
    errorMap: () => ({ message: 'Ответ должен быть "accepted" или "rejected"' }),
  }),
})

/** Обновление местоположения водителя */
export const updateLocationSchema = z.object({
  latitude: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  longitude: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  accuracy: z.union([z.number(), z.string()]).optional(),
  heading: z.union([z.number(), z.string()]).optional().nullable(),
  speed: z.union([z.number(), z.string()]).optional().nullable(),
  order_id: z.string().uuid().optional().nullable(),
}).refine((d) => !Number.isNaN(d.latitude) && !Number.isNaN(d.longitude), {
  message: 'Широта и долгота должны быть числами',
})

/** Push: подписка */
const subscriptionKeysSchema = z.object({
  p256dh: z.string(),
  auth: z.string(),
})
export const pushRegisterSchema = z.object({
  subscription: z.object({
    endpoint: z.string(),
    keys: subscriptionKeysSchema,
  }),
})

/** Push: отписка (endpoint) */
export const pushUnregisterSchema = z.object({
  endpoint: z.string().min(1, 'Endpoint обязателен'),
})

/** Уведомление водителей о заказе */
export const notifyDriversSchema = z.object({
  orderId: z.string().uuid('Некорректный ID заказа'),
  orderNumber: z.string().optional(),
  finalPrice: z.union([z.number(), z.string()]).optional(),
})

/** Admin: удаление пользователя */
export const adminDeleteUserSchema = z.object({
  userId: z.string().uuid('Некорректный ID пользователя'),
})

/** Admin: обновление пользователя */
export const adminUpdateUserSchema = z.object({
  userId: z.string().uuid('Некорректный ID пользователя'),
  fullName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  role: z.enum(['customer', 'driver', 'client', 'superadmin']).optional(),
  email: z.string().email().optional(),
})

/** Admin: сброс пароля (генерация ссылки по email) */
export const adminResetPasswordSchema = z.object({
  email: z.string().email('Некорректный email'),
})

/** Customer: отвязка водителя */
export const detachDriverSchema = z.object({
  driver_user_id: z.string().uuid('Некорректный ID водителя'),
})

/** Поиск водителей (customer) */
export const searchDriversSchema = z.object({
  search: z.string().optional(),
})

/** Driver: отклонение заказа */
export const rejectOrderSchema = z.object({
  orderId: z.string().uuid('Некорректный ID заказа'),
})

/** Driver: обновление профиля (частичное) */
export const driverProfileSchema = z.object({
  full_name: z.string().optional(),
  phone: z.string().optional(),
  vehicle_type: z.string().optional(),
  vehicle_brand: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_number: z.string().optional(),
})

/** Profile: создание */
export const profileCreateSchema = z.object({
  full_name: z.string().min(1, 'Имя обязательно'),
  phone: z.string().optional(),
  role: z.enum(['customer', 'driver', 'client']).optional(),
})

/** Profile: загрузка аватара — multipart, обрабатывается отдельно */

/** Push: отправка (внутренний вызов) */
export const pushSendSchema = z.object({
  userId: z.string().uuid().optional(),
  title: z.string(),
  body: z.string(),
  url: z.string().optional(),
})
