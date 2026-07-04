import { NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { createClient } from '@/lib/supabase/server'
import { getCurrentTenantId } from '@/lib/supabase/tenant'
import { extractMenuFromText, extractMenuFromImages } from '@/lib/ai'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const supabase = await createClient()
  await getCurrentTenantId(supabase) // garante que o usuário está autenticado

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo não enviado' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let items

    if (file.type === 'application/pdf') {
      const parser = new PDFParse({ data: buffer })
      const textResult = await parser.getText()

      if (textResult.text.trim().length > 50) {
        items = await extractMenuFromText(textResult.text)
      } else {
        // PDF sem texto real (provavelmente escaneado/foto) — renderiza as páginas como imagem
        const screenshots = await parser.getScreenshot({ first: 3, desiredWidth: 1200 })
        items = await extractMenuFromImages(screenshots.pages.map(p => p.dataUrl))
      }
      await parser.destroy()
    } else if (file.type.startsWith('image/')) {
      const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`
      items = await extractMenuFromImages([dataUrl])
    } else {
      return NextResponse.json({ error: 'Formato não suportado. Envie PDF, JPG ou PNG.' }, { status: 400 })
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Não consegui identificar itens de cardápio nesse arquivo.' }, { status: 422 })
    }

    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar arquivo' },
      { status: 500 }
    )
  }
}
