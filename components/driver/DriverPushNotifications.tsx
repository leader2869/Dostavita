'use client'

import { usePushNotifications } from '@/hooks/usePushNotifications'

export function DriverPushNotifications({ driverUserId }: { driverUserId: string }) {
  const { isSupported, isSubscribed, isBusy, error, subscribe, unsubscribe } = usePushNotifications(driverUserId)
  // Foreground offers are handled by NewOrderNotification. Only server Web Push
  // creates system notifications, avoiding duplicate alerts from Realtime.
  return <section className="mb-4 rounded-lg bg-white p-3 text-sm shadow" aria-label="Уведомления">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span>{isSubscribed ? 'Уведомления на этом устройстве включены' : 'Уведомления о новых заказах'}</span>
      {isSupported && <button type="button" disabled={isBusy}
        onClick={() => { void (isSubscribed ? unsubscribe() : subscribe()) }}
        className="rounded bg-brand-dark px-3 py-2 text-white disabled:opacity-50">
        {isBusy ? 'Подключение…' : isSubscribed ? 'Отключить на этом устройстве' : 'Включить уведомления'}
      </button>}
    </div>
    {!isSupported && <p className="mt-2 text-gray-600">Этот браузер не поддерживает push-уведомления. Доступные заказы можно смотреть в приложении.</p>}
    {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
  </section>
}
