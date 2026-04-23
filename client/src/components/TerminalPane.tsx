import { useRef, useEffect } from 'react';

import { useSession } from '../hooks/useSession';
import { terminalConfig } from '../terminal-config';
import type {
  Session,
  NotificationState,
  PlaybookCommandStatus,
  PlaybookConfig,
  PlaybookLogEntry,
} from '../types';
import DisconnectOverlay from './DisconnectOverlay';
import type { PlaybookPending } from './PlaybookToggleButton';
import PlaybookView from './PlaybookView';

interface TerminalPaneProps {
  session: Session;
  isActive: boolean;
  isActiveTab?: boolean;
  isAux?: boolean;
  showPlaybook?: boolean;
  playbookName?: string;
  playbookCommands?: PlaybookCommandStatus[];
  playbookLogs?: PlaybookLogEntry[];
  playbookRunning?: boolean;
  playbookPending?: PlaybookPending;
  playbookStartedAt?: number | null;
  onPlaybookStart?: () => void;
  onPlaybookStop?: () => void;
  onChangePlaybook?: () => void;
  onPlaybookOutput?: (entry: PlaybookLogEntry) => void;
  onPlaybookStatusChange?: (commands: PlaybookCommandStatus[], startedAt: number | null) => void;
  onPlaybookStopped?: () => void;
  onSendMessage?: (sendFn: (msg: object) => void) => void;
  onNotification?: (sessionId: string, state: NotificationState) => void;
  onBranchUpdate?: (sessionId: string, branch: string) => void;
  onConfigUpdate?: (cfg: { defaultDirectory?: string; playbooks: PlaybookConfig[] }) => void;
  onRestartSession?: () => void;
}

export default function TerminalPane({
  session,
  isActive,
  isActiveTab,
  isAux,
  showPlaybook,
  playbookName,
  playbookCommands,
  playbookLogs,
  playbookRunning,
  playbookPending,
  playbookStartedAt,
  onPlaybookStart,
  onPlaybookStop,
  onChangePlaybook,
  onPlaybookOutput,
  onPlaybookStatusChange,
  onPlaybookStopped,
  onSendMessage,
  onNotification,
  onBranchUpdate,
  onConfigUpdate,
  onRestartSession,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { disconnectReason, reconnect, sendMessage } = useSession(
    session.id,
    containerRef,
    isActive,
    onNotification,
    onBranchUpdate,
    onPlaybookOutput,
    onPlaybookStatusChange,
    onPlaybookStopped,
    onConfigUpdate,
  );

  useEffect(() => {
    onSendMessage?.(sendMessage);
  }, [sendMessage, onSendMessage]);

  // Only animate when toggling shells within the same active tab.
  // Skip animation when a tab first becomes active (snap to position instead).
  const wasActiveTabRef = useRef(false);
  const shouldAnimate = wasActiveTabRef.current && !!isActiveTab;
  useEffect(() => {
    wasActiveTabRef.current = !!isActiveTab;
  });

  const slide = isAux ? 'translate-x-full' : '-translate-x-full';
  const transition = shouldAnimate ? 'transition-transform duration-200 ease-out' : '';

  // Compute terminal visibility: handles aux shell, playbook, and normal states.
  // Uses the same shouldAnimate guard (via `transition`) so toggling animates
  // but switching tabs snaps to position.
  let terminalClass: string;
  if (!isActiveTab) {
    terminalClass = 'invisible';
  } else if (showPlaybook) {
    terminalClass = `${transition} pointer-events-none -translate-x-full`;
  } else if (isActive) {
    terminalClass = `${transition} translate-x-0`;
  } else {
    terminalClass = `${transition} pointer-events-none ${slide}`;
  }

  let playbookClass: string;
  if (!isActiveTab) {
    playbookClass = 'invisible';
  } else if (showPlaybook) {
    playbookClass = `${transition} translate-x-0`;
  } else {
    playbookClass = `${transition} pointer-events-none translate-x-full`;
  }

  return (
    <>
      <div
        style={{ backgroundColor: terminalConfig.theme.background as string }}
        className={`absolute inset-0 ${terminalClass}`}
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
      {playbookName && isActiveTab && (
        <div className={`absolute inset-0 ${playbookClass}`}>
          <PlaybookView
            playbookName={playbookName}
            commands={playbookCommands ?? []}
            logs={playbookLogs ?? []}
            isRunning={playbookRunning ?? false}
            pending={playbookPending}
            startedAt={playbookStartedAt ?? null}
            onStart={() => {
              sendMessage({ type: 'playbook:start', playbookName });
              onPlaybookStart?.();
            }}
            onStop={() => {
              sendMessage({ type: 'playbook:stop' });
              onPlaybookStop?.();
            }}
            onChangePlaybook={() => onChangePlaybook?.()}
          />
        </div>
      )}
    </>
  );
}
