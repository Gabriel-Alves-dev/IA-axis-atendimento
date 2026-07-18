import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import OrdersClient, { type OrderData } from './orders-client'

export default async function OrdersPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tenantId = await getCurrentTenantId(supabase, user?.id)

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(200)

  return <OrdersClient initialOrders={(orders ?? []) as OrderData[]} userEmail={user?.email} />
}
