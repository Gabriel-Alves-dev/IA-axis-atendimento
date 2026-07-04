import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import StoreForm, { type StoreProfileData } from './store-form'

export default async function StorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getCurrentTenantId(supabase)

  const { data: profile } = await supabase
    .from('store_profiles')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  return <StoreForm initialProfile={profile as StoreProfileData | null} userEmail={user?.email} />
}
