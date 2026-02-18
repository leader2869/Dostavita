import type { Metadata } from 'next'
import './globals.css'
import Script from 'next/script'
import { Amatic_SC } from 'next/font/google'

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
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning className={amaticSC.variable}>
      <head>
        <Script id="register-sw" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then((registration) => {
                    console.log('Service Worker зарегистрирован:', registration.scope)
                  })
                  .catch((error) => {
                    console.error('Ошибка регистрации Service Worker:', error)
                  })
              })
            }
          `}
        </Script>
      </head>
      <body style={{ backgroundColor: '#ffffff', margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
