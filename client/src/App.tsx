import { useState, useEffect, useRef } from 'react';
import type { Session } from './types';
import Sidebar from './components/Sidebar';
import TerminalPane from './components/TerminalPane';
import DirectoryPicker from './components/DirectoryPicker';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  useEffect(() => {
    fetch('/api/sessions')
      .then((res) => (res.ok ? res.json() : []))
      .then((existing: Session[]) => {
        if (existing.length > 0) {
          setSessions(existing);
          setActiveId(existing[0].id);
        }
      });
  }, []);

  useEffect(() => {
    if (sessions.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [sessions.length]);

  const handleNewSession = async (directory: string) => {
    setShowPicker(false);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory }),
    });
    if (!res.ok) return;
    const session: Session = await res.json();
    setSessions((prev) => [...prev, session]);
    setActiveId(session.id);
  };

  const handleCloseSession = async (id: string) => {
    const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (activeIdRef.current === id) {
        setActiveId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  return (
    <div className="h-full bg-[#0f1115] flex">
        <Sidebar
          sessions={sessions}
          activeId={activeId}
          onSelectSession={setActiveId}
          onCloseSession={handleCloseSession}
          onReorderSessions={setSessions}
          onNewTab={() => setShowPicker(true)}
        />

        <div className="flex-1 relative min-w-0">
            {sessions.length === 0 && !showPicker && (
              <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
                Open a tab to get started
              </div>
            )}

            {sessions.map((session) => (
              <TerminalPane
                key={session.id}
                session={session}
                isActive={session.id === activeId}
              />
            ))}

            {showPicker && (
              <DirectoryPicker
                onConfirm={handleNewSession}
                onCancel={() => setShowPicker(false)}
              />
            )}
        </div>
    </div>
  );
}
