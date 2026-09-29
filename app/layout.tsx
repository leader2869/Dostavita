import { TelegramBridge } from '@/components/telegram/TelegramBridge'
import type { Metadata } from 'next'
import './globals.css'
import { RegisterServiceWorker } from '@/components/pwa/RegisterServiceWorker'
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
  title: 'Dostavita',
  description: 'Dostavita — быстрая доставка',
  applicationName: 'Dostavita',
  manifest: '/manifest.json?v=dostavita-2',
  icons: {
    icon: [
      { url: '/icon-32x32.png?v=dostavita-2', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png?v=dostavita-2', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png?v=dostavita-2', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon-180x180.png?v=dostavita-2', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icon-32x32.png?v=dostavita-2',
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
        <link rel="icon" href="/icon-32x32.png?v=dostavita-2" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icon-192x192.png?v=dostavita-2" sizes="192x192" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-icon-180x180.png?v=dostavita-2" sizes="180x180" />
        {supabaseEnvScript ? (
          <script dangerouslySetInnerHTML={{ __html: supabaseEnvScript }} />
        ) : null}

      </head>
      <body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>
        <SupabaseEnvLoader>
          <TelegramBridge />
          <RegisterServiceWorker />
          {children}
          <Toaster />
        </SupabaseEnvLoader>
      </body>
    </html>
  )
}
