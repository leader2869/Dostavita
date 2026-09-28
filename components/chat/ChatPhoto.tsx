'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

/** Messages store object paths, never expiring signed URLs. */
export function ChatPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const supabase = createClient()
  useEffect(() => {
    let active = true
    setUrl(null)
    setFailed(false)
    const refresh = async () => {
      const { data, error } = await supabase.storage.from('chat-photos').createSignedUrl(path, 900)
      if (active) { setUrl(data?.signedUrl ?? null); setFailed(Boolean(error)) }
    }
    void refresh()
    const timer = setInterval(() => { void refresh() }, 600000)
    return () => { active = false; clearInterval(timer) }
  }, [path, supabase])
  if (!url) return <span className="text-sm text-gray-600">{failed ? 'Фото недоступно' : 'Загрузка фото…'}</span>
  return <Image src={url} alt="Фото в чате" width={300} height={300}
    className="rounded-lg max-w-full h-auto" unoptimized />
}
