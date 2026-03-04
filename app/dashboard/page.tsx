import { redirect } from 'next/navigation'
import { getCachedUserAndProfile } from '@/lib/supabase/cached-auth'

export const dynamic = 'force-dynamic'

const ROLE_ROUTES: Record<string, string> = {
  customer: '/dashboard/customer',
  client: '/dashboard/client',
  driver: '/dashboard/driver',
  fleet: '/dashboard/fleet',
  admin: '/dashboard/admin',
  superadmin: '/dashboard/admin',
}

export default async function DashboardPage() {
  const { user, profile } = await getCachedUserAndProfile()

  if (!user || !profile) {
    redirect('/login')
  }

  const role = (profile as { role: string }).role
  const route = ROLE_ROUTES[role]

  if (route) {
    redirect(route)
  }
  redirect('/dashboard/customer')
}
