'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'

export type StoreProfileInput = {
  storeName: string
  businessType: string
  address: string
  humanContact: string
  instagramUrl: string
  notes: string
  deliveryEnabled: boolean
  pickupEnabled: boolean
  deliveryFee: string
  minimumOrder: string
  estimatedTime: string
  pixKey: string
  paymentMethods: { pix: boolean; credit: boolean; debit: boolean; cash: boolean }
  openingHours: { day: string; open: boolean; start: string; end: string }[]
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

export async function saveStoreProfile(input: StoreProfileInput) {
  if (!input.storeName.trim() || !input.businessType) {
    throw new Error('Nome da loja e segmento são obrigatórios.')
  }

  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const paymentMethods = Object.entries(input.paymentMethods)
    .filter(([, enabled]) => enabled)
    .map(([method]) => method)

  const { error } = await supabase.from('store_profiles').upsert({
    tenant_id: tenantId,
    business_type: input.businessType,
    store_name: input.storeName.trim(),
    address: input.address.trim() || null,
    opening_hours: input.openingHours,
    delivery_rules: {
      delivery_enabled: input.deliveryEnabled,
      pickup_enabled: input.pickupEnabled,
      delivery_fee: parseNumber(input.deliveryFee),
      minimum_order: parseNumber(input.minimumOrder),
      estimated_time_minutes: parseNumber(input.estimatedTime),
      pix_key: input.pixKey.trim() || null,
    },
    payment_methods: paymentMethods,
    human_contact: input.humanContact.trim() || null,
    instagram_url: input.instagramUrl.trim() || null,
    notes: input.notes.trim() || null,
  }, { onConflict: 'tenant_id' })

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/store')
}
