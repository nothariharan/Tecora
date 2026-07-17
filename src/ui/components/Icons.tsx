import React from 'react';

// minimal stroke ("shade") icon set — lucide-style 24px viewBox, drawn with
// currentColor so any parent can tint them. one place to keep the whole panel's
// iconography consistent. size defaults to 16.

interface IconProps {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

function base(size: number, strokeWidth: number, style?: React.CSSProperties) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'block', flexShrink: 0, ...style },
  };
}

export function IconChats({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function IconInbox({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function IconFolder({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

export function IconFolderOpen({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconSearch({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function IconPlus({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

export function IconClose({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function IconMore({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
    </svg>
  );
}

export function IconExport({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function IconHelp({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function IconTrash({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconCheck({ size = 16, strokeWidth = 1.8, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconFolderInput({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M2 9V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-1" />
      <path d="M2 13h10" />
      <path d="m9 16 3-3-3-3" />
    </svg>
  );
}

export function IconTag({ size = 16, strokeWidth = 1.6, style }: IconProps) {
  return (
    <svg {...base(size, strokeWidth, style)}>
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}
