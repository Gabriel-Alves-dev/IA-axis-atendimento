'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'

export type MenuItemInput = {
  category: string
  name: string
  description: string
  price: number
  available: boolean
  notes: string
  ingredients: string[]
}

export async function saveMenuItem(input: MenuItemInput, id?: string) {
  if (!input.name.trim()) throw new Error('Nome do item é obrigatório')

  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const payload = {
    tenant_id: tenantId,
    category: input.category,
    name: input.name.trim(),
    description: input.description.trim() || null,
    price: input.price,
    available: input.available,
    notes: input.notes.trim() || null,
    ingredients: input.ingredients,
  }

  const { error } = id
    ? await supabase.from('menu_items').update(payload).eq('id', id).eq('tenant_id', tenantId)
    : await supabase.from('menu_items').insert(payload)

  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/menu')
}

export async function deleteMenuItem(id: string) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { error } = await supabase.from('menu_items').delete().eq('id', id).eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/menu')
}

export async function toggleMenuItemAvailable(id: string, available: boolean) {
  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const { error } = await supabase.from('menu_items').update({ available }).eq('id', id).eq('tenant_id', tenantId)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/menu')
}

/** Cria vários itens de uma vez — usado pela importação de cardápio (PDF/imagem). */
export async function bulkCreateMenuItems(inputs: MenuItemInput[]) {
  if (inputs.length === 0) return

  const supabase = await createClient()
  const tenantId = await getCurrentTenantId(supabase)

  const rows = inputs.map(input => ({
    tenant_id: tenantId,
    category: input.category,
    name: input.name.trim(),
    description: input.description.trim() || null,
    price: input.price,
    available: input.available,
    notes: input.notes.trim() || null,
    ingredients: input.ingredients,
  }))

  const { error } = await supabase.from('menu_items').insert(rows)
  if (error) throw new Error(error.message)

  revalidatePath('/dashboard/menu')
}
