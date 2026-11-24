const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded transition-colors disabled:pointer-events-none disabled:opacity-40'

export const button = {
  primary: `${base} h-8 px-3.5 text-sm font-medium bg-fg text-bg hover:bg-white`,
  secondary: `${base} h-8 px-3.5 text-sm border border-line-strong text-fg hover:bg-surface-2`,
  small: `${base} px-3 py-[5px] text-meta border border-line-strong text-muted hover:text-fg hover:bg-surface-2`,
  danger: `${base} px-3 py-[5px] text-meta border border-loss text-loss hover:bg-loss/10`,
}

export const link = 'text-muted hover:text-fg transition-colors'

export const field =
  'h-[34px] rounded border border-line bg-surface px-2.5 text-sm text-fg placeholder:text-faint outline-none transition-colors focus:border-muted disabled:opacity-40'

export const panel = 'rounded-lg border border-line bg-surface'

export const tableHead = 'text-xs text-faint pb-2 border-b border-line'

export const row = 'border-b border-line-row'

export const page =
  'mx-auto w-full max-w-[1160px] px-4 pt-10 pb-16 sm:px-6 flex flex-col gap-10'

export function deltaTone(delta: number): string {
  const n = Math.round(delta)
  return n > 0 ? 'text-win' : n < 0 ? 'text-loss' : 'text-faint'
}
