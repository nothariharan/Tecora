import React from 'react';

interface Props {
  hasData: boolean;
}

export function HealthBanner({ hasData }: Props) {
  if (hasData) return null;
  return (
    <div style={{
      padding: '10px 12px',
      background: '#fef9c3',
      borderBottom: '1px solid #fde047',
      fontSize: 12,
      color: '#713f12',
    }}>
      Navigate to claude.ai to load your chats.
    </div>
  );
}
