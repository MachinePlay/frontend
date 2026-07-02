// Time controls offered across the new-game and new-tournament forms
// ("base+inc" in seconds). Shared so both forms stay in sync.
export const TC_PRESETS = [
  { value: '10+0.1', label: '10s + 0.1' },
  { value: '30+0.3', label: '30s + 0.3' },
  { value: '60+1', label: '1m + 1' },
  { value: '180+2', label: '3m + 2' },
  { value: '300+3', label: '5m + 3' },
]

export const DEFAULT_TC = '30+0.3'
