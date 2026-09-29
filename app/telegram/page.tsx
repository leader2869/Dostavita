import Link from 'next/link'
import Image from 'next/image'

export default function TelegramEntryPage() {
  return <main className="min-h-screen bg-white px-6 py-12 text-gray-900">
    <div className="mx-auto max-w-sm">
      <Image src="/icon-192x192.png" alt="Dostavita" width={80} height={80} priority />
      <h1 className="mt-6 text-3xl font-bold">Dostavita в Telegram</h1>
      <p className="mt-3 text-gray-600">Заказы, доставки и финансы — в вашем привычном кабинете.</p>
      <Link href="/dashboard" className="mt-8 block rounded-xl bg-brand-dark px-5 py-3 text-center font-medium text-white">Открыть мой кабинет</Link>
      <p className="mt-3 text-sm text-gray-500">При первом входе используйте логин и пароль Dostavita. Ваши роль, компания и баланс сохранятся.</p>
      <Link href="/register" className="mt-6 block text-center text-sm underline">Создать аккаунт Dostavita</Link>
      <p className="mt-8 text-xs text-gray-500">Водителям: во время доставки держите приложение открытым. Передача геопозиции в фоне зависит от устройства и Telegram.</p>
    </div>
  </main>
}
