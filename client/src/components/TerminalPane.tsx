import { useRef } from 'react';
import type { Session, NotificationState } from '../types';
import { useSession } from '../hooks/useSession';
import { terminalConfig } from '../terminal-config';

interface TerminalPaneProps {
  session: Session;
  isActive: boolean;
  onNotification?: (sessionId: string, state: NotificationState) => void;
  onBranchUpdate?: (sessionId: string, branch: string) => void;
}

export default function TerminalPane({ session, isActive, onNotification, onBranchUpdate }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useSession(session.id, containerRef, isActive, onNotification, onBranchUpdate);

  return (
    <div
      ref={containerRef}
      style={{ backgroundColor: terminalConfig.theme.background as string }}
      className={`absolute inset-0 ${isActive ? '' : 'invisible'}`}
    />
  );
}
