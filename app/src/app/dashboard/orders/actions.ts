'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'

export async function updateOrderStatus(id: string, status: string) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/orders')
}
