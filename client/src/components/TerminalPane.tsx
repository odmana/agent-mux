import { useRef } from 'react';
import type { Session } from '../types';
import { useSession } from '../hooks/useSession';
import { terminalConfig } from '../terminal-config';

interface TerminalPaneProps {
  session: Session;
  isActive: boolean;
}

export default function TerminalPane({ session, isActive }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useSession(session.id, containerRef, isActive);

  return (
    <div
      ref={containerRef}
      style={{ backgroundColor: terminalConfig.theme.background as string }}
      className={`absolute inset-0 ${isActive ? '' : 'invisible'}`}
    />
  );
}
