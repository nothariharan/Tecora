// pure black / white / gray. side panel + palette share this set.

export const T = {
  bg: '#111111',
  fg: '#ffffff',
  muted: '#a3a3a3',
  faint: '#737373',
  icon: '#8a8a8a',
  border: '#262626',
  borderStrong: '#404040',
  hover: '#1a1a1a',
  selectedBg: '#262626',
  selectedFg: '#ffffff',
  pillBg: '#1a1a1a',
  pillStrongBg: '#333333',
  pillFg: '#a3a3a3',
  noticeBg: '#1a1a1a',
  noticeFg: '#a3a3a3',
  noticeBorder: '#262626',
  // destructive stays mono: white-on-black instead of red
  danger: '#ffffff',
  dangerBg: '#000000',
  radius: 4,
} as const;
