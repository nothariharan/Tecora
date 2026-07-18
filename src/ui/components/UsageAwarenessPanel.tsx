import React from 'react';
import type { PlatformUsageEstimate } from '@/src/core/usage';
import type { Platform } from '@/src/core/types';
import { T } from '../theme';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

function tokenText(tokens: number): string {
  if (tokens >= 1000) return `~${Math.round(tokens / 100) / 10}k tokens`;
  return `~${tokens} tokens`;
}

export function UsageAwarenessPanel({
  estimates,
}: {
  estimates: PlatformUsageEstimate[];
}) {
  const active = estimates.filter(
    (estimate) => estimate.messagesLastFiveHours > 0 || estimate.longestChat,
  );

  return (
    <section style={{
      padding: '9px 12px',
      borderBottom: `1px solid ${T.border}`,
      background: T.noticeBg,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.fg }}>Usage awareness</span>
        <span style={{ fontSize: 10.5, color: T.faint }}>local estimate, not platform quota</span>
      </div>

      <div style={{ fontSize: 11.2, color: T.muted, lineHeight: 1.4 }}>
        AI limits often use rolling windows. Tecora cannot know exact remaining messages unless a platform exposes them, but it can warn from your captured local activity.
      </div>

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
          {active.map((estimate) => (
            <div
              key={estimate.platform}
              style={{
                border: `1px solid ${T.border}`,
                borderRadius: T.radius,
                background: T.bg,
                padding: '6px 8px',
                fontSize: 11.2,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: T.fg, fontWeight: 600 }}>{PLATFORM_LABEL[estimate.platform]}</span>
                <span style={{ color: T.faint }}>
                  {estimate.messagesLastFiveHours} captured msgs / 5h
                </span>
              </div>
              {estimate.longestChat && (
                <div style={{ marginTop: 3, color: T.danger }}>
                  Longest chat: {tokenText(estimate.longestChat.approximateTokens)} · consider starting fresh
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
