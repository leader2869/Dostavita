import { NextResponse } from 'next/server'

/** Единый формат ошибки API */
export interface ApiErrorBody {
  code: string
  message: string
}

/** Успешный ответ: { success: true, data?: T } */
export interface ApiSuccessBody<T = unknown> {
  success: true
  data?: T
}

/** Ответ с ошибкой: { success: false, error: { code, message } } */
export interface ApiErrorResponseBody {
  success: false
  error: ApiErrorBody
}

/** Ответ API в одном из форматов (для обратной совместимости также допускается { error: string }) */
export type ApiResponseBody<T = unknown> =
  | ApiSuccessBody<T>
  | ApiErrorResponseBody
  | { error: string }

/**
 * Возвращает NextResponse с единым форматом успешного ответа.
 */
export function apiSuccess<T>(data?: T, status = 200) {
  return NextResponse.json({ success: true as const, data }, { status })
}

/**
 * Возвращает NextResponse с единым форматом ошибки.
 */
export function apiError(
  message: string,
  status = 400,
  code = 'ERROR'
) {
  return NextResponse.json(
    { success: false as const, error: { code, message } },
    { status }
  )
}

/** В production не отдаём внутренние сообщения ошибок клиенту */
export function maskInternalMessage(message: string): string {
  if (process.env.NODE_ENV === 'production') {
    return 'Внутренняя ошибка сервера'
  }
  return message
}
