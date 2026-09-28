import 'server-only'
import { isTrustedPushEndpoint } from '@/lib/push-endpoint'
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export function configurePush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://prosto.of.by', publicKey, privateKey
  )
  return true
}

export interface PushSubscriptionRow {
  endpoint: string
  p256dh_key: string
  auth_key: string
}

/** Не возвращаем клиенту адреса подписок, ключи или ошибки push-провайдера. */
export async function sendPush(
  admin: SupabaseClient,
  subscriptions: PushSubscriptionRow[],
  payload: Record<string, unknown>
) {
  const results = await Promise.allSettled(subscriptions.map(async (sub) => {
    if (!isTrustedPushEndpoint(sub.endpoint)) return false
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh_key, auth: sub.auth_key },
      }, JSON.stringify({
        icon: '/icon-192x192.png', badge: '/icon-192x192.png',
        requireInteraction: true, ...payload,
      }))
      return true
    } catch (error: unknown) {
      const status = (error as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        const { error: deleteError } = await admin.from('push_subscriptions')
          .delete().eq('endpoint', sub.endpoint)
        if (deleteError) console.error('Не удалось удалить истекшую push-подписку')
      }
      return false
    }
  }))
  const sent = results.filter((r) => r.status === 'fulfilled' && r.value).length
  return { sent, failed: subscriptions.length - sent, total: subscriptions.length }
}
