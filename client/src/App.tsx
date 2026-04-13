import { useState, useEffect, useRef, useCallback } from 'react';
import type { Session, NotificationState } from './types';
import Sidebar from './components/Sidebar';
import TerminalPane from './components/TerminalPane';
import DirectoryPicker from './components/DirectoryPicker';
import HooksBanner from './components/HooksBanner';
import { uiColors } from './terminal-config';
import Kbd from './components/Kbd';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [notificationStates, setNotificationStates] = useState<Record<string, NotificationState>>({});
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const showPickerRef = useRef(showPicker);
  showPickerRef.current = showPicker;

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

  const handleNotification = useCallback((sessionId: string, state: NotificationState) => {
    setNotificationStates(prev => ({ ...prev, [sessionId]: state }));
  }, []);

  const handleBranchUpdate = useCallback((sessionId: string, branch: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, branch } : s));
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveId(id);
    setNotificationStates(prev => {
      const next = { ...prev };
      let changed = false;
      // Clear idle on the tab we're leaving
      const prevId = activeIdRef.current;
      if (prevId && next[prevId] === 'idle') {
        next[prevId] = 'none';
        changed = true;
      }
      // Clear idle/working on the tab we're switching to
      if (next[id] === 'idle' || next[id] === 'working') {
        next[id] = 'none';
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey) return;

      if (e.code === 'KeyN') {
        e.preventDefault();
        e.stopPropagation();
        if (!showPickerRef.current) setShowPicker(true);
        return;
      }

      const match = e.code.match(/^Digit(\d)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= sessionsRef.current.length) {
          e.preventDefault();
          e.stopPropagation();
          handleSelectSession(sessionsRef.current[num - 1].id);
        }
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleSelectSession]);

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
    setNotificationStates(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="h-full flex" style={{ background: uiColors.pageBg, color: uiColors.textPrimary }}>
        <Sidebar
          sessions={sessions}
          activeId={activeId}
          notificationStates={notificationStates}
          onSelectSession={handleSelectSession}
          onCloseSession={handleCloseSession}
          onReorderSessions={setSessions}
          onNewTab={() => setShowPicker(true)}
        />

        <div className="flex-1 relative min-w-0">
            <HooksBanner />

            {sessions.length === 0 && !showPicker && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm" style={{ color: uiColors.textDim }}>
                <span>Open a tab to get started</span>
                <span className="flex items-center gap-1 mt-1">
                  <Kbd>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
                  <Kbd>Shift</Kbd>
                  <Kbd>N</Kbd>
                </span>
              </div>
            )}

            {sessions.map((session) => (
              <TerminalPane
                key={session.id}
                session={session}
                isActive={session.id === activeId}
                onNotification={handleNotification}
                onBranchUpdate={handleBranchUpdate}
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
