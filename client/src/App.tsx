import { useState } from 'react';
import type { Session } from './types';
import Sidebar from './components/Sidebar';
import TerminalPane from './components/TerminalPane';
import DirectoryPicker from './components/DirectoryPicker';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    const remaining = sessions.filter((s) => s.id !== id);
    setSessions(remaining);
    setActiveId((prev) => {
      if (prev !== id) return prev;
      return remaining.length > 0 ? remaining[0].id : null;
    });
  };

  return (
    <div className="h-full flex bg-[#0c0c0c] text-[#e4e4e7] font-sans">
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        onSelectSession={setActiveId}
        onCloseSession={handleCloseSession}
        onNewTab={() => setShowPicker(true)}
      />

      <div className="flex-1 relative">
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
