/** Only browser push services may receive server-side Web Push requests. */
export function isTrustedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') && (
        host === 'fcm.googleapis.com' ||
        host === 'updates.push.services.mozilla.com' ||
        host === 'web.push.apple.com' ||
        host.endsWith('.notify.windows.com')
      )
  } catch { return false }
}
