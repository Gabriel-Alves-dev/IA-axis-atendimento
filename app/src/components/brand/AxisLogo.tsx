/**
 * Marca da Axis.
 *
 * A logo definitiva ainda não existe — este é um símbolo placeholder desenhado em SVG
 * (um "A" geométrico com o traço de eixo/ascensão da marca). Quando a logo oficial
 * estiver pronta, salve o arquivo em `public/brand/axis-logo.svg` (ou .png) e troque
 * o conteúdo de <AxisMark> por um <img src="/brand/axis-logo.svg" /> — todos os
 * lugares da plataforma (sidebar, login, register) usam estes componentes.
 */

export function AxisMark({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-label="Axis">
      <defs>
        <linearGradient id="axis-grad" x1="6" y1="34" x2="34" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="oklch(0.52 0.11 175)" />
          <stop offset="1" stopColor="oklch(0.78 0.14 168)" />
        </linearGradient>
      </defs>
      {/* "A" geométrico: duas pernas + travessão em eixo ascendente */}
      <path
        d="M7 33 L20 7 L33 33"
        stroke="url(#axis-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 24 L27.5 24"
        stroke="url(#axis-grad)"
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      {/* nó do eixo no ápice — o "ponto de atendimento" */}
      <circle cx="20" cy="7" r="3.4" fill="oklch(0.78 0.14 168)" />
    </svg>
  )
}

export function AxisWordmark({ variant = 'default' }: { variant?: 'default' | 'sidebar' }) {
  return (
    <div className="leading-tight">
      <p className={`font-heading font-bold tracking-tight ${
        variant === 'sidebar' ? 'text-sm text-sidebar-foreground' : 'text-base text-foreground'
      }`}>
        axis <span className={variant === 'sidebar' ? 'text-sidebar-primary' : 'text-primary'}>atendimento</span>
      </p>
      <p className={`text-[10px] ${variant === 'sidebar' ? 'text-sidebar-foreground/50' : 'text-muted-foreground'}`}>
        IA no WhatsApp
      </p>
    </div>
  )
}

/** Assinatura de autoria exibida no rodapé das telas públicas e da sidebar. */
export function AxisSignature({ variant = 'default' }: { variant?: 'default' | 'sidebar' }) {
  return (
    <p className={`text-[10px] ${variant === 'sidebar' ? 'text-sidebar-foreground/40' : 'text-muted-foreground/70'}`}>
      Desenvolvido por <span className="font-medium">Gabriel Alves</span> · Axis © {new Date().getFullYear()}
    </p>
  )
}
