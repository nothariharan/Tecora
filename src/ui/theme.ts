// one monochrome token set for the whole side panel. no blue, no gradient —
// flat black / white / gray only. every component pulls its hex from here so
// the look stays consistent and easy to retune.

export const T = {
  bg: '#ffffff',
  fg: '#111111',
  muted: '#6b7280',
  faint: '#9ca3af',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  hover: '#f6f6f6',
  selectedBg: '#f0f0f0',
  selectedFg: '#000000',
  pillBg: '#ececec',
  pillFg: '#374151',
  // neutral notice (replaces the old yellow banner)
  noticeBg: '#f3f4f6',
  noticeFg: '#374151',
  noticeBorder: '#d1d5db',
} as const;
