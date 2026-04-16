import { useRef, useEffect } from 'react';

import { useSession } from '../hooks/useSession';
import { terminalConfig } from '../terminal-config';
import type { Session, NotificationState, PlaybookCommandStatus, PlaybookLogEntry } from '../types';
import DisconnectOverlay from './DisconnectOverlay';
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
  onPlaybookStart?: () => void;
  onPlaybookStop?: () => void;
  onChangePlaybook?: () => void;
  onPlaybookOutput?: (entry: PlaybookLogEntry) => void;
  onPlaybookStatusChange?: (commands: PlaybookCommandStatus[]) => void;
  onPlaybookStopped?: () => void;
  onSendMessage?: (sendFn: (msg: object) => void) => void;
  onNotification?: (sessionId: string, state: NotificationState) => void;
  onBranchUpdate?: (sessionId: string, branch: string) => void;
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
  onPlaybookStart,
  onPlaybookStop,
  onChangePlaybook,
  onPlaybookOutput,
  onPlaybookStatusChange,
  onPlaybookStopped,
  onSendMessage,
  onNotification,
  onBranchUpdate,
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

  let paneClass: string;
  if (!isActiveTab) {
    paneClass = 'invisible';
  } else if (isActive) {
    paneClass = `${transition} translate-x-0`;
  } else {
    paneClass = `${transition} pointer-events-none ${slide}`;
  }

  // Playbook slide: when playbook is shown, terminal slides left
  const playbookSlide = showPlaybook && isActiveTab ? '-translate-x-full' : 'translate-x-0';
  const playbookViewSlide = showPlaybook && isActiveTab ? 'translate-x-0' : 'translate-x-full';

  return (
    <>
      <div
        style={{ backgroundColor: terminalConfig.theme.background as string }}
        className={`absolute inset-0 ${paneClass} ${transition} ${playbookSlide}`}
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
        <div className={`absolute inset-0 ${transition} ${playbookViewSlide}`}>
          <PlaybookView
            playbookName={playbookName}
            commands={playbookCommands ?? []}
            logs={playbookLogs ?? []}
            isRunning={playbookRunning ?? false}
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
