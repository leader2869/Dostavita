import Image from 'next/image'
import { redirect } from 'next/navigation'
import type { User } from '@/lib/types'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'
import { DashboardAuthProvider } from '@/contexts/DashboardAuthContext'
import { DashboardNav } from '@/components/navigation/DashboardNav'
import { PageTitle } from '@/components/navigation/PageTitle'
import { DriverLayoutWrapper } from '@/components/driver/DriverLayoutWrapper'
import { BottomNavigationWrapper } from '@/components/navigation/BottomNavigationWrapper'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, profile, authError } = await getCachedUserAndProfile()

  if (authError && (authError.message?.includes('fetch failed') || authError.message?.includes('timeout'))) {
    console.error('Dashboard Layout: ошибка сети после попыток', authError)
  }
  if (authError || !user) {
    redirect('/login')
  }
  if (!profile) {
    redirect('/login')
  }

  const userProfile = profile as User

  return (
    <DriverLayoutWrapper>
      <DashboardAuthProvider
        user={{ id: user.id, email: user.email }}
        profile={userProfile}
      >
        <div className="min-h-screen bg-white relative">
          <nav className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900 tracking-tight"><Image src="/icon.svg?v=dostavita" alt="" width={40} height={40} />Dostavita</h1>
                  <PageTitle />
                </div>
                <DashboardNav profile={userProfile} userId={user.id} />
              </div>
            </div>
          </nav>
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 pb-10">
            {children}
          </main>
        </div>
        <BottomNavigationWrapper role={userProfile.role} />
      </DashboardAuthProvider>
    </DriverLayoutWrapper>
  )
}
