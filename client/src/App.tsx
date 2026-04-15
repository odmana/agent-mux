import { useState, useEffect, useRef, useCallback, Fragment } from 'react';

import DirectoryPicker from './components/DirectoryPicker';
import HooksBanner from './components/HooksBanner';
import Kbd from './components/Kbd';
import Sidebar from './components/Sidebar';
import TerminalPane from './components/TerminalPane';
import { uiColors } from './terminal-config';
import type { Session, NotificationState } from './types';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [notificationStates, setNotificationStates] = useState<Record<string, NotificationState>>(
    {},
  );
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const showPickerRef = useRef(showPicker);
  showPickerRef.current = showPicker;
  const [activeShell, setActiveShell] = useState<Record<string, 'primary' | 'aux'>>({});
  const activeShellRef = useRef(activeShell);
  activeShellRef.current = activeShell;

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
    setNotificationStates((prev) => ({ ...prev, [sessionId]: state }));
  }, []);

  const handleBranchUpdate = useCallback((sessionId: string, branch: string) => {
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, branch } : s)));
  }, []);

  const handleToggleAux = useCallback(async () => {
    const currentId = activeIdRef.current;
    if (!currentId) return;

    const session = sessionsRef.current.find((s) => s.id === currentId);
    if (!session) return;

    if (!session.auxId) {
      const res = await fetch(`/api/sessions/${currentId}/aux`, { method: 'POST' });
      if (!res.ok) return;
      const aux: { id: string } = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === currentId ? { ...s, auxId: aux.id } : s)));
      setActiveShell((prev) => ({ ...prev, [currentId]: 'aux' }));
    } else {
      setActiveShell((prev) => ({
        ...prev,
        [currentId]: prev[currentId] === 'aux' ? 'primary' : 'aux',
      }));
    }
  }, []);

  const handleSelectSession = useCallback((id: string) => {
    setActiveId(id);
    setNotificationStates((prev) => {
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

      if (e.code === 'Backslash') {
        e.preventDefault();
        e.stopPropagation();
        handleToggleAux();
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
  }, [handleSelectSession, handleToggleAux]);

  const handleRestartSession = useCallback(async (sessionId: string) => {
    const session = sessionsRef.current.find((s) => s.id === sessionId);
    if (!session) return;

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directory: session.directory }),
    });
    if (!res.ok) return;
    const newSession: Session = await res.json();

    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...newSession } : s)));
    if (activeIdRef.current === sessionId) {
      setActiveId(newSession.id);
    }
    setNotificationStates((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setActiveShell((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });

    fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const handleRestartAuxSession = useCallback(async (parentId: string) => {
    const session = sessionsRef.current.find((s) => s.id === parentId);
    if (!session?.auxId) return;

    const oldAuxId = session.auxId;
    fetch(`/api/sessions/${oldAuxId}`, { method: 'DELETE' }).catch(() => {});

    const res = await fetch(`/api/sessions/${parentId}/aux`, { method: 'POST' });
    if (!res.ok) return;
    const aux: { id: string } = await res.json();
    setSessions((prev) => prev.map((s) => (s.id === parentId ? { ...s, auxId: aux.id } : s)));
  }, []);

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
    setNotificationStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setActiveShell((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div
      className="flex h-full"
      style={{ background: uiColors.pageBg, color: uiColors.textPrimary }}
    >
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        activeShell={activeShell}
        notificationStates={notificationStates}
        onSelectSession={handleSelectSession}
        onCloseSession={handleCloseSession}
        onReorderSessions={setSessions}
        onNewTab={() => setShowPicker(true)}
      />

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <HooksBanner />

        {sessions.length === 0 && !showPicker && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-sm"
            style={{ color: uiColors.textDim }}
          >
            <span>Open a tab to get started</span>
            <span className="mt-1 flex items-center gap-1">
              <Kbd>{navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}</Kbd>
              <Kbd>Shift</Kbd>
              <Kbd>N</Kbd>
            </span>
          </div>
        )}

        {sessions.map((session) => (
          <Fragment key={session.id}>
            <TerminalPane
              session={session}
              isActive={session.id === activeId && activeShell[session.id] !== 'aux'}
              isActiveTab={session.id === activeId}
              onNotification={handleNotification}
              onBranchUpdate={handleBranchUpdate}
              onRestartSession={() => handleRestartSession(session.id)}
            />
            {session.auxId && (
              <TerminalPane
                key={session.auxId}
                session={{ ...session, id: session.auxId }}
                isActive={session.id === activeId && activeShell[session.id] === 'aux'}
                isActiveTab={session.id === activeId}
                isAux
                onRestartSession={() => handleRestartAuxSession(session.id)}
              />
            )}
          </Fragment>
        ))}

        {showPicker && (
          <DirectoryPicker onConfirm={handleNewSession} onCancel={() => setShowPicker(false)} />
        )}
      </div>
    </div>
  );
}
