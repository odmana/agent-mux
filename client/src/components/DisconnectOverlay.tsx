import { uiColors } from '../terminal-config';
import type { DisconnectReason } from '../types';

interface DisconnectOverlayProps {
  reason: DisconnectReason;
  onReconnect: () => void;
  onNewSession: () => void;
}

export default function DisconnectOverlay({
  reason,
  onReconnect,
  onNewSession,
}: DisconnectOverlayProps) {
  const isPtyExit = reason === 'pty_exited';

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
      <div className="flex flex-col items-center gap-3">
        <span className="text-sm" style={{ color: uiColors.textMuted }}>
          {isPtyExit ? 'Session ended' : 'Connection lost'}
        </span>
        <button
          type="button"
          onClick={isPtyExit ? onNewSession : onReconnect}
          className="cursor-pointer rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
          style={{ background: uiColors.accent, color: uiColors.pageBg }}
        >
          {isPtyExit ? 'New Session' : 'Reconnect'}
        </button>
      </div>
    </div>
  );
}
