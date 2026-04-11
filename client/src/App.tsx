import { useState } from 'react';
import type { Session } from './types';
import Sidebar from './components/Sidebar';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

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

      {/* Terminal pane */}
      <div className="flex-1 relative">
        {sessions.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
            Open a tab to get started
          </div>
        )}
      </div>
    </div>
  );
}
