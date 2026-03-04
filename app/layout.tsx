import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'
import { Amatic_SC } from 'next/font/google'
import { Toaster } from '@/components/ui/Toaster'
import { SupabaseEnvLoader } from '@/components/SupabaseEnvLoader'

const amaticSC = Amatic_SC({
  weight: '700',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
  variable: '--font-amatic-sc',
})

export const metadata: Metadata = {
  title: 'Просто!',
  description: 'Платформа для службы доставки',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon-32x32.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const supabaseEnvScript =
    supabaseUrl && supabaseAnonKey
      ? `window.__SUPABASE_ENV__={url:${JSON.stringify(supabaseUrl)},anonKey:${JSON.stringify(supabaseAnonKey)}};`
      : ''

  return (
    <html lang="ru" suppressHydrationWarning className={amaticSC.variable}>
      <head>
        <link rel="icon" href="/icon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icon-192x192.png" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon-180x180.png" sizes="180x180" />
        {supabaseEnvScript ? (
          <script dangerouslySetInnerHTML={{ __html: supabaseEnvScript }} />
        ) : null}
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js').catch((error) => {
                  if (process.env.NODE_ENV === 'development') {
                    console.error('Ошибка регистрации Service Worker:', error)
                  }
                })
              })
            }
          `}
        </Script>
      </head>
      <body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
        <SupabaseEnvLoader>
          {children}
          <Toaster />
        </SupabaseEnvLoader>
      </body>
    </html>
  )
}
