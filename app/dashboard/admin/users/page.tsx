'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BackButton } from '@/components/ui/BackButton'

export default function AdminUsersPage() {
  const router = useRouter()
  const supabase = createClient()
  
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

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Проверяем роль
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
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
  }

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
      alert('Пользователь успешно обновлен')
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
      alert('Пользователь успешно удален')
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
        <h1 className="text-3xl font-bold mb-6 text-white">Управление пользователями</h1>
        <p className="text-gray-400">Загрузка...</p>
      </div>
    )
  }

  return (
    <div>
      <BackButton />
      <h1 className="text-3xl font-bold mb-6 text-white">Управление пользователями</h1>

      <div className="bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">ФИО</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Телефон</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Роль</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Дата регистрации</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Действия</th>
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {users && users.length > 0 ? (
              users.map((user: any) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-white">
                    {user.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                    {roleLabels[user.role] || user.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {new Date(user.created_at).toLocaleDateString('ru-RU')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="text-green-500 hover:text-green-400"
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
                <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
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
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">Редактировать пользователя</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  ФИО
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Телефон
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Роль
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 text-white border border-gray-600 rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value} className="bg-gray-700">
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
                  className="flex-1 bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingUser(null)
                    setError(null)
                  }}
                  className="px-6 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
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
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4 text-white">Удалить пользователя</h2>

            <p className="text-gray-300 mb-6">
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
                className="flex-1 bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Удаление...' : 'Удалить'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setUserToDelete(null)
                  setError(null)
                }}
                className="px-6 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700"
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
