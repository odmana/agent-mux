import { useRef, useEffect } from 'react';

import { useSession } from '../hooks/useSession';
import { terminalConfig } from '../terminal-config';
import type { Session, NotificationState } from '../types';
import DisconnectOverlay from './DisconnectOverlay';

interface TerminalPaneProps {
  session: Session;
  isActive: boolean;
  isActiveTab?: boolean;
  isAux?: boolean;
  onNotification?: (sessionId: string, state: NotificationState) => void;
  onBranchUpdate?: (sessionId: string, branch: string) => void;
  onRestartSession?: () => void;
}

export default function TerminalPane({
  session,
  isActive,
  isActiveTab,
  isAux,
  onNotification,
  onBranchUpdate,
  onRestartSession,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { disconnectReason, reconnect } = useSession(
    session.id,
    containerRef,
    isActive,
    onNotification,
    onBranchUpdate,
  );

  // Only animate when toggling shells within the same active tab.
  // Skip animation when a tab first becomes active (snap to position instead).
  const wasActiveTabRef = useRef(false);
  const shouldAnimate = wasActiveTabRef.current && !!isActiveTab;
  useEffect(() => {
    wasActiveTabRef.current = !!isActiveTab;
  });

  const slide = isAux ? 'translate-x-full' : '-translate-x-full';
  const transition = shouldAnimate ? 'transition-transform duration-200 ease-out' : '';

  let paneClass: string;
  if (!isActiveTab) {
    paneClass = 'invisible';
  } else if (isActive) {
    paneClass = `${transition} translate-x-0`;
  } else {
    paneClass = `${transition} pointer-events-none ${slide}`;
  }

  return (
    <div
      style={{ backgroundColor: terminalConfig.theme.background as string }}
      className={`absolute inset-0 ${paneClass}`}
    >
      <div ref={containerRef} className="h-full w-full" />
      {disconnectReason && (
        <DisconnectOverlay
          reason={disconnectReason}
          onReconnect={reconnect}
          onNewSession={() => onRestartSession?.()}
        />
      )}
    </div>
  );
}
