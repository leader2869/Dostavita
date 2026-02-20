'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ClientProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (fetchError) {
          throw fetchError
        }

        if (data) {
          setProfile(data)
          setFullName(data.full_name || '')
          setPhone(data.phone || '')
          setEmail(data.email || user.email || '')
          setOrganizationName(data.organization_name || '')
          setAvatarUrl(data.avatar_url || null)
        } else {
          // Профиль не найден, создаем его через API route (обходит RLS)
          const response = await fetch('/api/profile/create', {
            method: 'POST',
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Ошибка создания профиля')
          }

          const { profile: newProfile } = await response.json()

          if (newProfile) {
            setProfile(newProfile)
            setFullName(newProfile.full_name || '')
            setPhone(newProfile.phone || '')
            setEmail(newProfile.email || user.email || '')
            setOrganizationName(newProfile.organization_name || '')
            setAvatarUrl(newProfile.avatar_url || null)
          }
        }
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [supabase, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Не авторизован')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          organization_name: organizationName || null,
          // Телефон не обновляем - его можно изменить только через админа
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      // Обновляем профиль в состоянии
      setProfile({ ...profile, full_name: fullName, organization_name: organizationName, phone: phone })
      
      // Показываем сообщение об успешном сохранении
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
      }, 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      // Используем window.location для полной перезагрузки страницы
      window.location.href = '/login'
    } catch (error) {
      console.error('Ошибка при выходе:', error)
      // В случае ошибки все равно перенаправляем на login
      window.location.href = '/login'
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('avatar', file)

      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка загрузки аватара')
      }

      const { avatar_url } = await response.json()
      setAvatarUrl(avatar_url)
      setProfile({ ...profile, avatar_url })
      alert('Аватар успешно загружен')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return (
      <div className="pb-20">
        <p className="text-gray-600">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="pb-20">

      <form onSubmit={handleSubmit} className="bg-gray-50 rounded-lg shadow p-6 space-y-4">
        {/* Аватар */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Аватар"
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-gray-300 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 bg-brand-light text-gray-900 rounded-full p-2 cursor-pointer hover:bg-brand-dark transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                disabled={uploadingAvatar}
              />
            </label>
          </div>
          {uploadingAvatar && (
            <p className="text-sm text-gray-600 mt-2">Загрузка...</p>
          )}
        </div>
        <div>
          <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 mb-1">
            Наименование организации
          </label>
          <input
            id="organizationName"
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
            placeholder="ООО «Название организации»"
          />
          <p className="text-xs text-gray-600 mt-1">Необязательное поле</p>
        </div>

        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            ФИО
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
            placeholder="Иванов Иван Иванович"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Телефон
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
            placeholder="+375 (XX) XXX-XX-XX"
          />
          <p className="text-xs text-gray-600 mt-1">Телефон нельзя изменить. Для изменения обратитесь к администратору.</p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            disabled
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600"
          />
          <p className="text-xs text-gray-600 mt-1">Email нельзя изменить</p>
        </div>

        {error && (
          <div className="text-red-600 text-sm">{error}</div>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-green-300 text-gray-900 px-6 py-2 rounded-md hover:bg-green-400 disabled:opacity-50"
          >
            {saving ? 'Сохранение...' : saved ? 'Изменения сохранены' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 bg-red-300 text-gray-900 rounded-md hover:bg-red-400"
          >
            Отмена
          </button>
        </div>
      </form>

    </div>
  )
}

