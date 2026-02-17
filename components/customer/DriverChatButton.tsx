'use client'

import { DriverOrganizationChatButton } from '@/components/chat/DriverOrganizationChatButton'

interface DriverChatButtonProps {
  organizationId: string
  driverId: string
  currentUserId: string
}

export function DriverChatButton({ organizationId, driverId, currentUserId }: DriverChatButtonProps) {
  return (
    <DriverOrganizationChatButton
      organizationId={organizationId}
      driverId={driverId}
      currentUserId={currentUserId}
      currentUserRole="customer"
      className=""
      showLabel={true}
    />
  )
}

