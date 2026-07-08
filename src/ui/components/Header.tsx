import React from 'react';
import type { Platform } from '@/src/core/types';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

interface Props {
  platform: Platform | null;
}

export function Header({ platform }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 14px 8px',
      borderBottom: '1px solid #e5e7eb',
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>Tecora</span>
      {platform && (
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#6b7280',
          background: '#f3f4f6',
          borderRadius: 4,
          padding: '2px 6px',
        }}>
          {PLATFORM_LABEL[platform]}
        </span>
      )}
    </div>
  );
}
