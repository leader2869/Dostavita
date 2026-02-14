import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dostavita',
  description: 'Платформа для службы доставки',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body style={{ backgroundColor: '#111827', margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
