'use client'

import { useState } from 'react'
import Header from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  Plus, Pencil, Trash2, Search, UtensilsCrossed,
  Loader2, Check, X, Upload, FileUp,
} from 'lucide-react'
import { saveMenuItem, deleteMenuItem, toggleMenuItemAvailable, bulkCreateMenuItems, type MenuItemInput } from './actions'

export type MenuItemData = {
  id: string
  category: string
  name: string
  description: string | null
  price: number | null
  available: boolean
  notes: string | null
  ingredients: string[] | null
}

const CATEGORIES = ['Lanches', 'Bebidas', 'Porções', 'Sobremesas', 'Combos', 'Outros']

const emptyForm: MenuItemInput = {
  category: 'Lanches',
  name: '',
  description: '',
  price: 0,
  available: true,
  notes: '',
  ingredients: [],
}

function toForm(item: MenuItemData): MenuItemInput {
  return {
    category: item.category,
    name: item.name,
    description: item.description ?? '',
    price: item.price ?? 0,
    available: item.available,
    notes: item.notes ?? '',
    ingredients: item.ingredients ?? [],
  }
}

export default function MenuClient({ initialItems, userEmail }: { initialItems: MenuItemData[]; userEmail?: string | null }) {
  const [items, setItems] = useState(initialItems)
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<MenuItemData | null>(null)
  const [form, setForm] = useState<MenuItemInput>(emptyForm)
  const [ingredientsText, setIngredientsText] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importSaving, setImportSaving] = useState(false)
  const [reviewItems, setReviewItems] = useState<Array<MenuItemInput & { include: boolean }> | null>(null)

  const filtered = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !selectedCategory || item.category === selectedCategory
    return matchSearch && matchCategory
  })

  const categories = [...new Set(items.map(i => i.category))]

  const handleOpenCreate = () => {
    setEditingItem(null)
    setForm(emptyForm)
    setIngredientsText('')
    setDialogOpen(true)
  }

  const handleOpenEdit = (item: MenuItemData) => {
    setEditingItem(item)
    const f = toForm(item)
    setForm(f)
    setIngredientsText(f.ingredients.join(', '))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Nome do item é obrigatório')
      return
    }
    setSaving(true)
    const ingredients = ingredientsText.split(',').map(s => s.trim()).filter(Boolean)
    const payload: MenuItemInput = { ...form, ingredients }

    try {
      await saveMenuItem(payload, editingItem?.id)
      if (editingItem) {
        setItems(items.map(i => i.id === editingItem.id ? { ...i, ...payload } : i))
        toast.success('Item atualizado!')
      } else {
        // A revalidatePath do Server Action já busca os dados reais na próxima navegação;
        // aqui só refletimos localmente pra resposta imediata.
        setItems([...items, { id: crypto.randomUUID(), ...payload }])
        toast.success('Item adicionado ao cardápio!')
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar item')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteMenuItem(id)
      setItems(items.filter(i => i.id !== id))
      toast.success('Item removido.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover item')
    } finally {
      setDeletingId(null)
    }
  }

  const handleToggleAvailable = async (id: string) => {
    const item = items.find(i => i.id === id)
    if (!item) return
    const next = !item.available
    setItems(items.map(i => i.id === id ? { ...i, available: next } : i))
    try {
      await toggleMenuItemAvailable(id, next)
    } catch (err) {
      setItems(items.map(i => i.id === id ? { ...i, available: !next } : i))
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar disponibilidade')
    }
  }

  const handleOpenImport = () => {
    setReviewItems(null)
    setImportOpen(true)
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/menu/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar arquivo')

      setReviewItems(
        (data.items as Array<{ category: string; name: string; description: string; price: number | null; ingredients: string[] }>)
          .map(i => ({
            category: i.category,
            name: i.name,
            description: i.description,
            price: i.price ?? 0,
            available: true,
            notes: '',
            ingredients: i.ingredients,
            include: true,
          }))
      )
      toast.success(`${data.items.length} item(ns) encontrado(s). Revise antes de salvar.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao processar arquivo')
    } finally {
      setImporting(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!reviewItems) return
    const toSave = reviewItems.filter(i => i.include && i.name.trim())
    if (toSave.length === 0) {
      toast.error('Selecione ao menos um item')
      return
    }
    setImportSaving(true)
    try {
      const inputs: MenuItemInput[] = toSave.map(i => ({
        category: i.category, name: i.name, description: i.description, price: i.price, available: i.available, notes: i.notes, ingredients: i.ingredients,
      }))
      await bulkCreateMenuItems(inputs)
      setItems([...items, ...inputs.map(i => ({ id: crypto.randomUUID(), ...i }))])
      toast.success(`${toSave.length} item(ns) adicionado(s) ao cardápio!`)
      setImportOpen(false)
      setReviewItems(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar itens')
    } finally {
      setImportSaving(false)
    }
  }

  const updateReviewItem = (index: number, patch: Partial<MenuItemInput & { include: boolean }>) => {
    setReviewItems(prev => prev ? prev.map((it, i) => i === index ? { ...it, ...patch } : it) : prev)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header title="Cardápio / Base" subtitle="Gerencie os produtos e informações que a IA conhece" userEmail={userEmail} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto">

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar item..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/50"
              />
            </div>
            <Button onClick={handleOpenImport} variant="outline" className="shrink-0">
              <Upload className="w-4 h-4 mr-2" />
              Importar cardápio
            </Button>
            <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
              <Plus className="w-4 h-4 mr-2" />
              Adicionar item
            </Button>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                !selectedCategory ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({items.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCategory === cat ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat} ({items.filter(i => i.category === cat).length})
              </button>
            ))}
          </div>

          {/* Items list grouped by category */}
          <div className="space-y-6">
            {[...new Set(filtered.map(i => i.category))].map(cat => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">{cat}</h3>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-2">
                  {filtered.filter(i => i.category === cat).map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        item.available ? 'border-border bg-card' : 'border-border/50 bg-card/50 opacity-60'
                      }`}
                    >
                      <Switch
                        checked={item.available}
                        onCheckedChange={() => handleToggleAvailable(item.id)}
                        className="shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{item.name}</p>
                          {!item.available && (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground border-border">
                              Indisponível
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                        {item.ingredients && item.ingredients.length > 0 && (
                          <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                            Ingredientes: {item.ingredients.join(', ')}
                          </p>
                        )}
                        {item.notes && <p className="text-xs text-yellow-500/80 mt-0.5">{item.notes}</p>}
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm text-foreground">
                          R$ {(item.price ?? 0).toFixed(2).replace('.', ',')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-8 h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <UtensilsCrossed className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">Nenhum item encontrado</p>
                <p className="text-sm text-muted-foreground mt-1">Adicione itens ao cardápio para a IA conhecer</p>
                <Button onClick={handleOpenCreate} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar primeiro item
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar item' : 'Novo item'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço (R$)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={form.price || ''}
                  onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                  className="bg-secondary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemName">Nome do item *</Label>
              <Input
                id="itemName"
                placeholder="Ex: X-Bacon"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descrição curta"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="bg-secondary/50 min-h-[70px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ingredients">Ingredientes</Label>
              <p className="text-xs text-muted-foreground">Separados por vírgula</p>
              <Input
                id="ingredients"
                placeholder="Ex: pão, hambúrguer 150g, queijo, bacon"
                value={ingredientsText}
                onChange={e => setIngredientsText(e.target.value)}
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações internas</Label>
              <Input
                id="notes"
                placeholder="Ex: Só disponível até 14h"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-secondary/50"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <span className="text-sm font-medium">Disponível</span>
              <Switch
                checked={form.available}
                onCheckedChange={v => setForm(f => ({ ...f, available: v }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setReviewItems(null) }}>
        <DialogContent className="sm:max-w-2xl bg-card border-border max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar cardápio</DialogTitle>
            <DialogDescription>Envie um PDF ou uma imagem/foto do seu cardápio — a IA lê e monta os itens pra você revisar.</DialogDescription>
          </DialogHeader>

          {!reviewItems ? (
            <div className="py-6">
              <label
                htmlFor="menu-import-file"
                className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                  importing ? 'border-border bg-secondary/20 pointer-events-none' : 'border-border hover:border-primary/40 hover:bg-secondary/20'
                }`}
              >
                {importing ? (
                  <>
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <p className="text-sm text-muted-foreground">Lendo o arquivo e identificando os itens...</p>
                  </>
                ) : (
                  <>
                    <FileUp className="w-8 h-8 text-muted-foreground" />
                    <p className="text-sm font-medium">Clique para escolher um arquivo</p>
                    <p className="text-xs text-muted-foreground">PDF, JPG ou PNG</p>
                  </>
                )}
              </label>
              <input
                id="menu-import-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={handleFileSelected}
                disabled={importing}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                {reviewItems.length} item(ns) encontrado(s) — revise nomes, preços e categorias antes de salvar.
              </p>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {reviewItems.map((item, i) => (
                  <div key={i} className={`p-3 rounded-lg border border-border space-y-2 ${!item.include ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-2">
                      <Switch checked={item.include} onCheckedChange={v => updateReviewItem(i, { include: v })} className="mt-1 shrink-0" />
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                        <Input
                          value={item.name}
                          onChange={e => updateReviewItem(i, { name: e.target.value })}
                          placeholder="Nome do item"
                          className="bg-secondary/50 h-8 text-sm"
                        />
                        <select
                          value={item.category}
                          onChange={e => updateReviewItem(i, { category: e.target.value })}
                          className="h-8 rounded-md border border-border bg-secondary/50 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.price || ''}
                          onChange={e => updateReviewItem(i, { price: parseFloat(e.target.value) || 0 })}
                          placeholder="Preço"
                          className="bg-secondary/50 h-8 text-sm w-28"
                        />
                      </div>
                    </div>
                    <Input
                      value={item.ingredients.join(', ')}
                      onChange={e => updateReviewItem(i, { ingredients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                      placeholder="Ingredientes separados por vírgula"
                      className="bg-secondary/50 h-8 text-xs ml-8"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setImportOpen(false); setReviewItems(null) }}>
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
            {reviewItems && (
              <Button onClick={handleConfirmImport} disabled={importSaving} className="bg-primary text-primary-foreground">
                {importSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Salvar {reviewItems.filter(i => i.include).length} item(ns)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
