// one monochrome token set for the whole side panel. no blue, no gradient —
// flat black / white / gray only. every component pulls its hex from here so
// the look stays consistent and easy to retune.

// dark token set, matched to the ctrl+k palette (#111 surface, light text,
// #262626/#333 borders). every component pulls its hex from here so the side
// panel and the palette read as one product.

export const T = {
  bg: '#111111',
  fg: '#f3f4f6',
  muted: '#9ca3af',
  faint: '#6b7280',
  icon: '#8a8a93',
  border: '#262626',
  borderStrong: '#333333',
  hover: '#1c1c1c',
  selectedBg: '#262626',
  selectedFg: '#ffffff',
  pillBg: '#232323',
  pillStrongBg: '#333333',
  pillFg: '#9ca3af',
  // neutral notice strip
  noticeBg: '#1a1a1a',
  noticeFg: '#9ca3af',
  noticeBorder: '#262626',
  danger: '#f87171',
  dangerBg: 'rgba(248,113,113,0.14)',
  radius: 8,
} as const;
