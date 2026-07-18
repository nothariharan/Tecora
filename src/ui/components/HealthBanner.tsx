import React from 'react';
import { T } from '../theme';

interface Props {
  hasData: boolean;
  hasActiveAccount: boolean;
}

export function HealthBanner({ hasData, hasActiveAccount }: Props) {
  if (hasData) return null;

  const message = hasActiveAccount
    ? 'Waiting for chats… refresh the page or open Recents on Claude, ChatGPT, or Gemini.'
    : 'Open Claude, ChatGPT, or Gemini (logged in) and wait a few seconds — Tecora reads the chat list from the page.';

  return (
    <div style={{
      padding: '10px 12px',
      background: T.noticeBg,
      borderBottom: `1px solid ${T.noticeBorder}`,
      fontSize: 12,
      color: T.noticeFg,
    }}>
      {message}
    </div>
  );
}
