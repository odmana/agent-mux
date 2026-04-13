import { useState, useEffect } from 'react';

import { uiColors } from '../terminal-config';

type BannerState =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'needed'; missing: string[] }
  | { kind: 'error'; message: string }
  | { kind: 'installing' }
  | { kind: 'installed' };

export default function HooksBanner() {
  const [state, setState] = useState<BannerState>({ kind: 'loading' });

  useEffect(() => {
    fetch('/api/hooks/status')
      .then((res) => res.json())
      .then((status) => {
        if (status.configured) {
          setState({ kind: 'hidden' });
        } else if (status.error) {
          setState({ kind: 'error', message: status.error });
        } else {
          setState({ kind: 'needed', missing: status.missing });
        }
      })
      .catch(() => setState({ kind: 'hidden' }));
  }, []);

  useEffect(() => {
    if (state.kind === 'installed') {
      const timer = setTimeout(() => setState({ kind: 'hidden' }), 2000);
      return () => clearTimeout(timer);
    }
  }, [state.kind]);

  if (state.kind === 'loading' || state.kind === 'hidden') return null;

  const handleInstall = async () => {
    setState({ kind: 'installing' });
    try {
      const res = await fetch('/api/hooks/install', { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        setState({ kind: 'installed' });
      } else {
        setState({ kind: 'error', message: result.error ?? 'Installation failed' });
      }
    } catch {
      setState({ kind: 'error', message: 'Failed to connect to server' });
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 5,
        background: 'rgba(129, 161, 193, 0.08)',
        borderLeft: `3px solid ${uiColors.accent}`,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div style={{ flex: 1, fontSize: '13px' }}>
        {state.kind === 'installed' ? (
          <span style={{ color: uiColors.notificationWorking }}>Hooks installed successfully.</span>
        ) : state.kind === 'error' ? (
          <span style={{ color: uiColors.textMuted }}>{state.message}</span>
        ) : (
          <span style={{ color: uiColors.textMuted }}>
            Notification dots require hooks in{' '}
            <code style={{ color: uiColors.textPrimary, fontSize: '12px' }}>
              ~/.claude/settings.json
            </code>
            . Agent-mux can install them automatically — a backup will be created first.
          </span>
        )}
      </div>

      {state.kind === 'needed' && (
        <button
          onClick={handleInstall}
          style={{
            background: uiColors.accent,
            color: uiColors.pageBg,
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Install Hooks
        </button>
      )}

      {state.kind === 'installing' && (
        <span style={{ color: uiColors.textDim, fontSize: '12px', whiteSpace: 'nowrap' }}>
          Installing...
        </span>
      )}

      {state.kind !== 'installed' && (
        <button
          onClick={() => setState({ kind: 'hidden' })}
          style={{
            background: 'transparent',
            color: uiColors.textDim,
            border: 'none',
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
