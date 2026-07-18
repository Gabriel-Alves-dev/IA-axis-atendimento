import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import MenuClient, { type MenuItemData } from './menu-client'

export default async function MenuPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const tenantId = await getCurrentTenantId(supabase, user?.id)

  const { data: items } = await supabase
    .from('menu_items')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('category')
    .order('name')

  return <MenuClient initialItems={(items ?? []) as MenuItemData[]} userEmail={user?.email} />
}
