import React, { useEffect, useState } from 'react';
import type { RuntimeRequest, RuntimeResponse } from '@/src/core/bus';
import type { ActivityLogEntry, Platform, PrivacySettings } from '@/src/core/types';
import { DEFAULT_PRIVACY_SETTINGS } from '@/src/core/privacy';
import { T } from '../theme';

const PLATFORM_LABEL: Record<Platform, string> = {
  claude: 'Claude',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
};

function formatAction(action: ActivityLogEntry['action']): string {
  return action.replace(/_/g, ' ');
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

async function loadPrivacySettings(): Promise<PrivacySettings> {
  const res = (await browser.runtime.sendMessage({
    type: 'get_privacy_settings',
  } satisfies RuntimeRequest)) as RuntimeResponse;
  return res.type === 'get_privacy_settings_ok' ? res.settings : DEFAULT_PRIVACY_SETTINGS;
}

async function loadActivity(): Promise<ActivityLogEntry[]> {
  const res = (await browser.runtime.sendMessage({
    type: 'list_activity',
    limit: 8,
  } satisfies RuntimeRequest)) as RuntimeResponse;
  return res.type === 'list_activity_ok' ? res.entries : [];
}

export function PrivacyActivityPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_PRIVACY_SETTINGS);
  const [activity, setActivity] = useState<ActivityLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [nextSettings, nextActivity] = await Promise.all([
      loadPrivacySettings(),
      loadActivity(),
    ]);
    setSettings(nextSettings);
    setActivity(nextActivity);
  }

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  async function setCapture(platform: Platform, enabled: boolean) {
    const next: PrivacySettings = {
      captureMessages: {
        ...settings.captureMessages,
        [platform]: enabled,
      },
    };
    setSettings(next);
    const res = (await browser.runtime.sendMessage({
      type: 'set_privacy_settings',
      settings: next,
    } satisfies RuntimeRequest)) as RuntimeResponse;
    if (res.type === 'set_privacy_settings_ok') {
      setSettings(res.settings);
      setActivity(await loadActivity());
    }
  }

  async function wipeAllData() {
    const confirmed = window.confirm(
      'Wipe everything Tecora has stored on this browser profile?\n\nThis clears chats, messages, folders, tags, activity log, bulk queue, and privacy settings. It cannot be undone unless you have an archive export.',
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await browser.runtime.sendMessage({ type: 'wipe_all_data' } satisfies RuntimeRequest);
      setSettings(DEFAULT_PRIVACY_SETTINGS);
      setActivity([]);
      window.alert('Tecora local data was wiped.');
    } finally {
      setBusy(false);
    }
  }

  const smallButton: React.CSSProperties = {
    fontSize: 11,
    color: T.muted,
    background: 'transparent',
    border: `1px solid ${T.borderStrong}`,
    borderRadius: T.radius,
    padding: '3px 7px',
    cursor: 'pointer',
  };

  return (
    <section style={{ borderBottom: `1px solid ${T.border}` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'transparent',
          border: 'none',
          color: T.fg,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 11.5, fontWeight: 700 }}>Privacy & activity</span>
        <span style={{ color: T.faint, fontSize: 11 }}>{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 10px', color: T.muted }}>
          <div style={{
            border: `1px solid ${T.border}`,
            borderRadius: T.radius,
            padding: 9,
            marginBottom: 8,
            background: T.noticeBg,
          }}>
            <div style={{ fontSize: 11, color: T.fg, fontWeight: 700, marginBottom: 6 }}>
              Message content capture
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(Object.keys(PLATFORM_LABEL) as Platform[]).map((platform) => (
                <label
                  key={platform}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}
                >
                  <input
                    type="checkbox"
                    checked={settings.captureMessages[platform]}
                    onChange={(e) => void setCapture(platform, e.currentTarget.checked)}
                    style={{ accentColor: T.fg }}
                  />
                  Store {PLATFORM_LABEL[platform]} message text for search/export previews
                </label>
              ))}
            </div>
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 7 }}>
              Turning a platform off removes stored message text for that platform and keeps future capture to titles/metadata.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: T.fg, fontWeight: 700 }}>Recent local activity</span>
            <button type="button" onClick={() => void refresh()} style={smallButton}>
              Refresh
            </button>
          </div>

          {activity.length === 0 ? (
            <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 8 }}>
              No activity logged yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
              {activity.map((entry) => (
                <div key={entry.id} style={{ fontSize: 11.2, color: T.muted }}>
                  <span style={{ color: T.fg }}>{formatAction(entry.action)}</span>
                  <span style={{ color: T.faint }}> · {relativeTime(entry.at)}</span>
                  <div style={{ color: T.faint }}>{entry.detail}</div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => void wipeAllData()}
            style={{
              ...smallButton,
              color: T.danger,
              background: T.dangerBg,
              opacity: busy ? 0.5 : 1,
            }}
          >
            Wipe all Tecora data
          </button>
        </div>
      )}
    </section>
  );
}
