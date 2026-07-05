import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import StoreForm, { type StoreProfileData } from './store-form'

export default async function StorePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = await getCurrentTenantId(supabase)

  const { data: profile } = await supabase
    .from('store_profiles')
    .select(`
      business_type, store_name, address, human_contact, instagram_url, notes,
      delivery_rules, payment_methods, opening_hours,
      has_mp_token:mercadopago_access_token
    `)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  // mercadopago_access_token nunca é lido em texto puro — só sabemos se existe ou não.
  const safeProfile = profile ? { ...profile, has_mp_token: Boolean(profile.has_mp_token) } : null

  return <StoreForm initialProfile={safeProfile as StoreProfileData | null} userEmail={user?.email} />
}
