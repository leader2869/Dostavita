'use client'

import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
        style: { fontFamily: 'inherit' },
      }}
    />
  )
}
