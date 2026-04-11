import { useRef } from 'react';
import type { Session } from '../types';
import { useSession } from '../hooks/useSession';

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
      className={`absolute inset-0 ${isActive ? '' : 'invisible'}`}
    />
  );
}
