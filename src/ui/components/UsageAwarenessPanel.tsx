import React from 'react';
import {
  formatReset,
  type PlatformLiveUsage,
  type PlatformUsageEstimate,
} from '@/src/core/usage';
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

function UsageBar({ percent }: { percent: number }) {
  return (
    <div style={{ height: 4, background: T.border, borderRadius: 3, overflow: 'hidden' }}>
      <div
        style={{
          width: `${Math.max(2, percent)}%`,
          height: '100%',
          background: percent >= 100 ? T.danger : T.fg,
        }}
      />
    </div>
  );
}

function LiveUsageCard({ live }: { live: PlatformLiveUsage }) {
  return (
    <div
      style={{
        border: `1px solid ${T.border}`,
        borderRadius: T.radius,
        background: T.bg,
        padding: '7px 9px',
        fontSize: 11.2,
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 7,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: T.fg, fontWeight: 600 }}>{PLATFORM_LABEL[live.platform]}</span>
          {live.planType && (
            <span
              style={{
                fontSize: 9.5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: T.muted,
                border: `1px solid ${T.borderStrong}`,
                borderRadius: 3,
                padding: '1px 5px',
              }}
            >
              {live.planType}
            </span>
          )}
        </span>
        <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.fg }}>
          live
        </span>
      </div>

      {live.windows.map((w) => {
        const reset = formatReset(w.resetsAt);
        return (
          <div key={w.key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: T.muted }}>{w.label} window</span>
              <span style={{ color: T.fg }}>
                {w.usedPercent}% used{reset ? ` · ${reset}` : ''}
              </span>
            </div>
            <UsageBar percent={w.usedPercent} />
          </div>
        );
      })}

      {live.limitReached && (
        <div style={{ color: T.danger }}>Limit reached — new messages may be blocked until reset.</div>
      )}
    </div>
  );
}

export function UsageAwarenessPanel({
  estimates,
  live,
}: {
  estimates: PlatformUsageEstimate[];
  live?: PlatformLiveUsage | null;
}) {
  const active = estimates.filter(
    (estimate) => estimate.messagesLastFiveHours > 0 || estimate.longestChat,
  );

  const sectionLabel: React.CSSProperties = {
    fontSize: 9.5,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: T.faint,
    marginTop: 10,
  };

  return (
    <section style={{
      padding: '9px 12px',
      borderBottom: `1px solid ${T.border}`,
      background: T.noticeBg,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: T.fg }}>Usage awareness</span>
        <span style={{ fontSize: 10.5, color: T.faint }}>
          {live ? 'live quota + local activity' : 'local activity only'}
        </span>
      </div>

      {live ? (
        <>
          {/* real quota, straight from the platform — the number to trust */}
          <LiveUsageCard live={live} />
          {active.length > 0 && <div style={sectionLabel}>Captured in this browser</div>}
        </>
      ) : (
        <div style={{ fontSize: 11.2, color: T.muted, lineHeight: 1.4 }}>
          AI limits use rolling windows Tecora can't read here. The counts below are
          only what Tecora captured in this browser — treat them as a rough activity
          signal, not your quota.
        </div>
      )}

      {active.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: live ? 4 : 8 }}>
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

      {active.length > 0 && (
        <div style={{ fontSize: 10, color: T.faint, lineHeight: 1.4, marginTop: 6 }}>
          Counts only messages captured in this browser — misses your phone, the mobile
          app, and other devices. Token figures are approximate (~chars ÷ 4).
        </div>
      )}
    </section>
  );
}
