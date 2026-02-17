'use client'

import { DriverOrganizationChatButton } from '@/components/chat/DriverOrganizationChatButton'

interface GeneralChatButtonProps {
  organizationId: string
  currentUserId: string
}

export function GeneralChatButton({ organizationId, currentUserId }: GeneralChatButtonProps) {
  return (
    <DriverOrganizationChatButton
      organizationId={organizationId}
      driverId={null}
      currentUserId={currentUserId}
      currentUserRole="customer"
      className=""
      showLabel={true}
    />
  )
}

