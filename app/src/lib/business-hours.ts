type OpeningHoursEntry = { day: string; open: boolean; start: string; end: string }

// Mesma ordem/nomes usados em app/src/app/dashboard/store/store-form.tsx (DAYS)
const WEEKDAY_TO_PT: Record<string, string> = {
  Sun: 'Domingo',
  Mon: 'Segunda',
  Tue: 'Terça',
  Wed: 'Quarta',
  Thu: 'Quinta',
  Fri: 'Sexta',
  Sat: 'Sábado',
}

function minutesInSaoPaulo(): { weekdayPt: string; minutes: number } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? '0')

  return { weekdayPt: WEEKDAY_TO_PT[weekday] ?? 'Domingo', minutes: hour * 60 + minute }
}

/** opening_hours: [{ day: "Segunda", open: true, start: "11:00", end: "22:00" }, ...] (fuso America/Sao_Paulo). */
export function isStoreOpen(openingHours: OpeningHoursEntry[] | null | undefined): boolean {
  if (!openingHours || openingHours.length === 0) return true // sem horário cadastrado: não bloqueia o atendimento

  const { weekdayPt, minutes } = minutesInSaoPaulo()
  const today = openingHours.find(d => d.day === weekdayPt)
  if (!today || !today.open) return false

  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }

  const startMin = toMinutes(today.start)
  let endMin = toMinutes(today.end)
  if (endMin <= startMin) endMin += 24 * 60 // cruza a meia-noite

  return minutes >= startMin && minutes <= endMin
}
