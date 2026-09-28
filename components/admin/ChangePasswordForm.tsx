'use client'

import { useState } from 'react'

export function ChangePasswordForm({ userId }: { userId: string }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  return <form className="space-y-3 rounded-lg bg-white p-5 shadow" onSubmit={async event => {
    event.preventDefault()
    setError(''); setSuccess(false)
    if (password !== confirmation) { setError('Пароли не совпадают'); return }
    setBusy(true)
    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Не удалось изменить пароль')
      setPassword(''); setConfirmation(''); setSuccess(true)
    } catch (err) { setError(err instanceof Error ? err.message : 'Ошибка сети') }
    finally { setBusy(false) }
  }}>
    <h2 className="text-xl font-semibold">Новый пароль пользователя</h2>
    <p className="text-sm text-gray-600">После сохранения для входа нужен новый пароль. Текущий пароль посмотреть нельзя.</p>
    <label className="block">Новый пароль
      <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full rounded border p-2" />
    </label>
    <label className="block">Повторите пароль
      <input type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} className="mt-1 block w-full rounded border p-2" />
    </label>
    <p className="text-sm text-gray-600">От 12 до 128 символов.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {success && <p role="status" className="text-green-700">Пароль изменён.</p>}
    <button disabled={busy} className="rounded bg-sky-200 px-4 py-2 disabled:opacity-50">{busy ? 'Сохранение…' : 'Сохранить новый пароль'}</button>
  </form>
}
