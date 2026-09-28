import type { SupabaseClient } from '@supabase/supabase-js'

/** Only the server's confirmed per-user receipts may change the local read state. */
export async function markOrgMessagesRead(supabase: SupabaseClient, messageIds: string[]) {
  const ids = [...new Set(messageIds)]
  const receipts: { id: string; read_at: string }[] = []
  for (let offset = 0; offset < ids.length; offset += 500) {
    const { data, error } = await supabase.rpc('mark_org_messages_read', {
      message_ids: ids.slice(offset, offset + 500),
    })
    if (error) throw error
    receipts.push(...(data ?? []))
  }
  return receipts
}
