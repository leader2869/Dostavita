'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'
import { toastSuccess } from '@/lib/utils/toast'
import { useDashboardUser } from '@/contexts/DashboardAuthContext'

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = createClient()
  const { profile } = useDashboardUser()
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [userToDelete, setUserToDelete] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Форма редактирования
  const [editFullName, setEditFullName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<string>('client')

  const loadUsers = useCallback(async () => {
    try {
      if (profile.role !== 'admin' && profile.role !== 'superadmin') {
        router.push('/dashboard')
        return
      }

      // Получаем всех пользователей
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_all_users')

      if (usersError) {
        // Fallback на прямой запрос
        const { data: directUsers } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100)

        if (directUsers) {
          setUsers(directUsers)
        }
      } else {
        setUsers(usersData || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [supabase, router, profile.role])

  const handleEdit = (user: any) => {
    setEditingUser(user)
    setEditFullName(user.full_name || '')
    setEditPhone(user.phone || '')
    setEditEmail(user.email || '')
    setEditRole(user.role || 'client')
    setShowEditModal(true)
    setError(null)
  }

  const handleDelete = (user: any) => {
    setUserToDelete(user)
    setShowDeleteModal(true)
  }

  const handleSaveEdit = async () => {
    if (!editingUser) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: editingUser.id,
          fullName: editFullName,
          phone: editPhone,
          email: editEmail,
          role: editRole,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка обновления пользователя')
      }

      setShowEditModal(false)
      setEditingUser(null)
      await loadUsers()
      toastSuccess('Пользователь успешно обновлен')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!userToDelete) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userToDelete.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Ошибка удаления пользователя')
      }

      setShowDeleteModal(false)
      setUserToDelete(null)
      await loadUsers()
      toastSuccess('Пользователь успешно удален')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const roleLabels: Record<string, string> = {
    customer: 'Организация',
    client: 'Клиент',
    driver: 'Исполнитель',
    fleet: 'Автопарк',
    admin: 'Администратор',
    superadmin: 'Суперадмин',
  }

  const roleOptions = [
    { value: 'client', label: 'Клиент' },
    { value: 'customer', label: 'Организация' },
    { value: 'driver', label: 'Исполнитель' },
    { value: 'fleet', label: 'Автопарк' },
    { value: 'admin', label: 'Администратор' },
    { value: 'superadmin', label: 'Суперадмин' },
  ]

  if (loading) {
    return (
      <div>
        <BackButton />
        <h1 className="text-3xl font-bold mb-6 text-gray-900">Управление пользователями</h1>
        <p className="text-gray-600">Загрузка...</p>
      </div>
    )
  }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-gray-900">Управление пользователями</h1>

      <div className="bg-gray-50 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-white">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">ФИО</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Телефон</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Роль</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Дата регистрации</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-gray-50 divide-y divide-gray-700">
            {users && users.length > 0 ? (
              users.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {user.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {roleLabels[user.role] || user.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-brand-light hover:text-brand-light"
                      >
                        Редактировать
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="text-red-500 hover:text-red-400"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-600">
                  Нет пользователей
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Модальное окно редактирования */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-50 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Редактировать пользователя</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-light focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ФИО
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-light focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-light focus:border-brand-light"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Роль
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-100 text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-brand-light focus:border-brand-light"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-gray-100">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded border border-red-800">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="flex-1 bg-green-300 text-gray-900 px-6 py-2 rounded-md hover:bg-green-400 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                    setError(null)
                  }}
                  className="px-6 py-2 bg-red-300 text-gray-900 rounded-md hover:bg-red-400"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно удаления */}
      {showDeleteModal && userToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-50 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-900">Удалить пользователя</h2>

            <p className="text-gray-700 mb-6">
              Вы уверены, что хотите удалить пользователя <strong>{userToDelete.email}</strong>?
              Это действие нельзя отменить.
            </p>

            {error && (
              <div className="text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded border border-red-800 mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleConfirmDelete}
                disabled={saving}
                className="flex-1 bg-red-300 text-gray-900 px-6 py-2 rounded-md hover:bg-red-400 disabled:opacity-50"
              >
                {saving ? 'Удаление...' : 'Удалить'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setUserToDelete(null)
                  setError(null)
                }}
                className="px-6 py-2 bg-red-300 text-gray-900 rounded-md hover:bg-red-400"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
