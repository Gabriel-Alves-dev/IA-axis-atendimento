// Instruções injetadas no system_prompt via {{tone_instruction}} — precisam existir aqui
// (usadas pelo webhook) e como opções na tela Configurar IA (agent-form.tsx, TONES).
export const TONE_INSTRUCTIONS: Record<string, string> = {
  profissional: 'Fale de forma formal, objetiva e cortês. Evite gírias, emojis e informalidade.',
  amigavel: 'Fale de forma cordial e próxima, como alguém simpático que já conhece o cliente. Pode usar emojis com moderação.',
  informal: 'Fale de forma descontraída e casual, como numa conversa entre amigos.',
  objetivo: 'Vá direto ao ponto — frases curtas, sem rodeios nem textos longos.',
  divertido: 'Seja leve e bem-humorado, com uma pitada de humor. Pode usar emojis com mais liberdade.',
  premium: 'Fale de forma sofisticada e elegante, transmitindo exclusividade e cuidado.',
}

export function getToneInstruction(tone: string | null | undefined): string {
  return TONE_INSTRUCTIONS[tone ?? ''] ?? TONE_INSTRUCTIONS.amigavel
}
