'use client'

import { toast as sonnerToast } from 'sonner'

/**
 * Извлекает текст ошибки из ответа API.
 * Поддерживает форматы: { error: string } и { success: false, error: { message } }.
 */
export function getApiErrorMessage(res: unknown): string {
  if (res && typeof res === 'object') {
    const obj = res as Record<string, unknown>
    if (typeof obj.error === 'string') return obj.error
    if (obj.error && typeof obj.error === 'object' && obj.error !== null) {
      const msg = (obj.error as Record<string, unknown>).message
      if (typeof msg === 'string') return msg
    }
  }
  return 'Произошла ошибка'
}

/** Показать успех (тост) */
export function toastSuccess(message: string) {
  sonnerToast.success(message)
}

/** Показать ошибку (тост) */
export function toastError(message: string) {
  sonnerToast.error(message)
}

/** Показать ошибку из ответа API (парсит формат и вызывает toast.error) */
export function toastApiError(res: unknown) {
  toastError(getApiErrorMessage(res))
}
