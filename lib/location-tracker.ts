interface TrackerOptions {
  orderId: string | null
  interval: number
  onTracking: (active: boolean) => void
  onError: (message: string | null) => void
}

interface TrackerEnvironment {
  geolocation: Pick<Geolocation, 'getCurrentPosition'>
  network: Pick<Window, 'addEventListener' | 'removeEventListener'>
  visibility: Pick<Document, 'addEventListener' | 'removeEventListener'>
  isOnline: () => boolean
  isVisible: () => boolean
  fetch: typeof fetch
  every: (callback: () => void, delay: number) => number
  cancelEvery: (id: number) => void
  later: (callback: () => void, delay: number) => number
  cancelLater: (id: number) => void
}

/** A foreground browser tracker; does not claim background execution guarantees. */
export function startLocationTracker(options: TrackerOptions, env: TrackerEnvironment) {
  let stopped = false
  let busy = false
  let timer: number | null = null
  let requestController: AbortController | null = null
  const stopTimer = () => { if (timer !== null) { env.cancelEvery(timer); timer = null } }
  const setFailure = (message: string) => { options.onTracking(false); options.onError(message) }
  const acquire = (fresh = false) => {
    if (stopped || busy) return
    if (!env.isOnline()) { setFailure('Нет связи. Геопозиция обновится после подключения.'); return }
    busy = true
    env.geolocation.getCurrentPosition(async position => {
      if (stopped) { busy = false; return }
      requestController = new AbortController()
      const controller = requestController
      const timeout = env.later(() => controller.abort(), 15000)
      try {
        const response = await env.fetch('/api/driver/update-location', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude,
            accuracy: position.coords.accuracy, heading: position.coords.heading ?? null,
            speed: position.coords.speed ?? null, order_id: options.orderId }),
        })
        if (!response.ok) throw new Error('Не удалось сохранить геопозицию. Повторим попытку.')
        if (!stopped) { options.onTracking(true); options.onError(null) }
      } catch {
        if (!stopped) setFailure('Геопозиция не отправлена. Проверьте связь; попытка повторится.')
      } finally {
        env.cancelLater(timeout)
        busy = false
        if (requestController === controller) requestController = null
      }
    }, error => {
      busy = false
      if (stopped) return
      if (error.code === 1) {
        stopTimer()
        setFailure('Доступ к геолокации запрещён. Разрешите его в настройках браузера и вернитесь в приложение.')
      } else {
        setFailure(error.code === 3 ? 'Ожидание GPS истекло. Повторим попытку.' : 'GPS временно недоступен. Повторим попытку.')
      }
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: fresh ? 0 : 30000 })
  }
  const startTimer = () => { if (timer === null) timer = env.every(() => acquire(), options.interval) }
  const resume = () => { if (!stopped && env.isVisible()) { startTimer(); acquire(true) } }
  const offline = () => {
    if (!stopped) { requestController?.abort(); setFailure('Нет связи. Геопозиция обновится после подключения.') }
  }
  env.network.addEventListener('online', resume)
  env.network.addEventListener('offline', offline)
  env.visibility.addEventListener('visibilitychange', resume)
  options.onTracking(false)
  startTimer()
  acquire(true)
  return () => {
    stopped = true
    stopTimer()
    requestController?.abort()
    env.network.removeEventListener('online', resume)
    env.network.removeEventListener('offline', offline)
    env.visibility.removeEventListener('visibilitychange', resume)
  }
}
