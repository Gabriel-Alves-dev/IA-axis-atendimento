'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Save, Loader2, Clock, CreditCard, MapPin, Phone, AtSign, Building2, Truck } from 'lucide-react'
import { saveStoreProfile, type StoreProfileInput } from './actions'

const BUSINESS_TYPES = [
  { value: 'lanchonete', label: 'Lanchonete' },
  { value: 'pizzaria', label: 'Pizzaria' },
  { value: 'barbearia', label: 'Barbearia' },
  { value: 'clinica', label: 'Clínica Estética' },
  { value: 'loja', label: 'Loja de Roupas' },
  { value: 'assistencia', label: 'Assistência Técnica' },
  { value: 'imobiliaria', label: 'Imobiliária' },
  { value: 'outro', label: 'Outro' },
]

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']

export type StoreProfileData = {
  business_type: string
  store_name: string
  address: string | null
  human_contact: string | null
  instagram_url: string | null
  notes: string | null
  delivery_rules: {
    delivery_enabled?: boolean
    pickup_enabled?: boolean
    delivery_fee?: number | null
    minimum_order?: number | null
    estimated_time_minutes?: number | null
    pix_key?: string | null
  } | null
  payment_methods: string[] | null
  opening_hours: { day: string; open: boolean; start: string; end: string }[] | null
  has_mp_token?: boolean
}

function buildInitialForm(profile: StoreProfileData | null): StoreProfileInput {
  const deliveryRules = profile?.delivery_rules ?? {}
  const paymentMethods = profile?.payment_methods ?? ['pix', 'credit', 'debit', 'cash']
  const openingHours = profile?.opening_hours?.length
    ? profile.opening_hours
    : DAYS.map(day => ({ day, open: day !== 'Domingo', start: '11:00', end: '22:00' }))

  return {
    storeName: profile?.store_name ?? '',
    businessType: profile?.business_type ?? '',
    address: profile?.address ?? '',
    humanContact: profile?.human_contact ?? '',
    instagramUrl: profile?.instagram_url ?? '',
    notes: profile?.notes ?? '',
    deliveryEnabled: deliveryRules.delivery_enabled ?? true,
    pickupEnabled: deliveryRules.pickup_enabled ?? true,
    deliveryFee: deliveryRules.delivery_fee != null ? String(deliveryRules.delivery_fee) : '',
    minimumOrder: deliveryRules.minimum_order != null ? String(deliveryRules.minimum_order) : '',
    estimatedTime: deliveryRules.estimated_time_minutes != null ? String(deliveryRules.estimated_time_minutes) : '',
    pixKey: deliveryRules.pix_key ?? '',
    mercadopagoAccessToken: '',
    paymentMethods: {
      pix: paymentMethods.includes('pix'),
      credit: paymentMethods.includes('credit'),
      debit: paymentMethods.includes('debit'),
      cash: paymentMethods.includes('cash'),
    },
    openingHours,
  }
}

export default function StoreForm({ initialProfile, userEmail }: { initialProfile: StoreProfileData | null; userEmail?: string | null }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<StoreProfileInput>(() => buildInitialForm(initialProfile))
  const hasMpToken = initialProfile?.has_mp_token ?? false

  const handleSave = async () => {
    if (!form.storeName.trim() || !form.businessType) {
      toast.error('Preencha nome da loja e segmento.')
      return
    }
    setLoading(true)
    try {
      await saveStoreProfile(form)
      toast.success('Dados salvos com sucesso!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar dados.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Minha Empresa" subtitle="Dados da loja que a IA usará para atender clientes" userEmail={userEmail} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Basic info */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-primary" />
              Informações básicas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storeName">Nome da loja *</Label>
                <Input
                  id="storeName"
                  placeholder="Ex: Lanchonete da Tia Maria"
                  value={form.storeName}
                  onChange={e => setForm(f => ({ ...f, storeName: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="businessType">Segmento *</Label>
                <Select value={form.businessType} onValueChange={v => v && setForm(f => ({ ...f, businessType: v }))}>
                  <SelectTrigger id="businessType" className="bg-secondary/50">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Endereço
                </Label>
                <Input
                  id="address"
                  placeholder="Rua, número, bairro, cidade"
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="humanContact" className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Telefone para suporte humano
                </Label>
                <Input
                  id="humanContact"
                  placeholder="+55 11 9 9999-9999"
                  value={form.humanContact}
                  onChange={e => setForm(f => ({ ...f, humanContact: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram" className="flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5" /> Instagram
                </Label>
                <Input
                  id="instagram"
                  placeholder="@lanchonete"
                  value={form.instagramUrl}
                  onChange={e => setForm(f => ({ ...f, instagramUrl: e.target.value }))}
                  className="bg-secondary/50"
                />
              </div>
            </div>
          </section>

          {/* Delivery */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <Truck className="w-4 h-4 text-primary" />
              Entrega e retirada
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Entrega habilitada</p>
                  <p className="text-xs text-muted-foreground">IA oferece opção de delivery</p>
                </div>
                <Switch
                  checked={form.deliveryEnabled}
                  onCheckedChange={v => setForm(f => ({ ...f, deliveryEnabled: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Retirada no local</p>
                  <p className="text-xs text-muted-foreground">Cliente pode retirar na loja</p>
                </div>
                <Switch
                  checked={form.pickupEnabled}
                  onCheckedChange={v => setForm(f => ({ ...f, pickupEnabled: v }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="deliveryFee">Taxa de entrega (R$)</Label>
                  <Input
                    id="deliveryFee"
                    placeholder="5,00"
                    value={form.deliveryFee}
                    onChange={e => setForm(f => ({ ...f, deliveryFee: e.target.value }))}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="minimumOrder">Pedido mínimo (R$)</Label>
                  <Input
                    id="minimumOrder"
                    placeholder="20,00"
                    value={form.minimumOrder}
                    onChange={e => setForm(f => ({ ...f, minimumOrder: e.target.value }))}
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estimatedTime">Tempo médio (min)</Label>
                  <Input
                    id="estimatedTime"
                    placeholder="40"
                    value={form.estimatedTime}
                    onChange={e => setForm(f => ({ ...f, estimatedTime: e.target.value }))}
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <CreditCard className="w-4 h-4 text-primary" />
              Formas de pagamento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              {[
                { key: 'pix', label: 'PIX' },
                { key: 'credit', label: 'Cartão de Crédito' },
                { key: 'debit', label: 'Cartão de Débito' },
                { key: 'cash', label: 'Dinheiro' },
              ].map(method => (
                <div key={method.key} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                  <span className="text-sm font-medium">{method.label}</span>
                  <Switch
                    checked={form.paymentMethods[method.key as keyof typeof form.paymentMethods]}
                    onCheckedChange={v => setForm(f => ({
                      ...f,
                      paymentMethods: { ...f.paymentMethods, [method.key]: v }
                    }))}
                  />
                </div>
              ))}
            </div>
            {form.paymentMethods.pix && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="pixKey">Chave PIX (fallback manual)</Label>
                  <Input
                    id="pixKey"
                    placeholder="CPF, e-mail, telefone ou chave aleatória"
                    value={form.pixKey}
                    onChange={e => setForm(f => ({ ...f, pixKey: e.target.value }))}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usada só se você não conectar o Mercado Pago abaixo: a IA manda essa chave fixa e o pedido entra como &quot;aguardando confirmação&quot; até alguém confirmar o pagamento manualmente.
                  </p>
                </div>

                <div className="space-y-2 p-4 rounded-lg bg-secondary/30 border border-border">
                  <Label htmlFor="mpToken" className="flex items-center gap-1.5">
                    <CreditCard className="w-3.5 h-3.5" /> Token de acesso do Mercado Pago (recomendado)
                  </Label>
                  <Input
                    id="mpToken"
                    type="password"
                    placeholder={hasMpToken ? '•••••••••••• (token salvo — deixe em branco para manter)' : 'APP_USR-...'}
                    value={form.mercadopagoAccessToken}
                    onChange={e => setForm(f => ({ ...f, mercadopagoAccessToken: e.target.value }))}
                    className="bg-secondary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cole o &quot;Access Token de produção&quot; da sua própria conta Mercado Pago. Com isso, cada pedido no PIX gera um QR Code/código copia-e-cola real e o pedido só é confirmado automaticamente quando o pagamento cair — sem depender do cliente avisar. O dinheiro cai direto na sua conta Mercado Pago, não passa pela plataforma.
                  </p>
                  {hasMpToken && (
                    <p className="text-xs text-emerald-400">✓ Mercado Pago conectado.</p>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Hours */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-5">
              <Clock className="w-4 h-4 text-primary" />
              Horário de funcionamento
            </h3>
            <div className="space-y-3">
              {form.openingHours.map((h, i) => (
                <div key={h.day} className="flex items-center gap-4">
                  <div className="w-20 shrink-0">
                    <span className="text-sm font-medium">{h.day}</span>
                  </div>
                  <Switch
                    checked={h.open}
                    onCheckedChange={v => setForm(f => ({
                      ...f,
                      openingHours: f.openingHours.map((d, idx) => idx === i ? { ...d, open: v } : d)
                    }))}
                  />
                  {h.open ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={h.start}
                        onChange={e => setForm(f => ({
                          ...f,
                          openingHours: f.openingHours.map((d, idx) => idx === i ? { ...d, start: e.target.value } : d)
                        }))}
                        className="bg-secondary/50 w-28"
                      />
                      <span className="text-muted-foreground text-sm">até</span>
                      <Input
                        type="time"
                        value={h.end}
                        onChange={e => setForm(f => ({
                          ...f,
                          openingHours: f.openingHours.map((d, idx) => idx === i ? { ...d, end: e.target.value } : d)
                        }))}
                        className="bg-secondary/50 w-28"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Fechado</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold text-sm mb-4">Observações internas</h3>
            <Textarea
              placeholder="Informações adicionais para a IA usar, ex: 'Não fazemos substituições no cardápio', 'Aceitamos encomendas com 48h de antecedência'..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="bg-secondary/50 min-h-[100px]"
            />
          </section>

          {/* Save button */}
          <div className="flex justify-end pb-6">
            <Button onClick={handleSave} disabled={loading} className="bg-primary text-primary-foreground hover:bg-primary/90 px-8">
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" /> Salvar dados</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
