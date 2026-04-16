import { useState, useEffect, useRef, useCallback, Fragment } from 'react';

import DirectoryPicker from './components/DirectoryPicker';
import HooksBanner from './components/HooksBanner';
import Kbd from './components/Kbd';
import PlaybookSelector from './components/PlaybookSelector';
import Sidebar from './components/Sidebar';
import TerminalPane from './components/TerminalPane';
import { uiColors } from './terminal-config';
import type {
  Session,
  NotificationState,
  PlaybookConfig,
  PlaybookCommandStatus,
  PlaybookLogEntry,
} from './types';

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

  const [defaultDirectory, setDefaultDirectory] = useState('~/');
  const [sidebarWidth, setSidebarWidth] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [playbooks, setPlaybooks] = useState<PlaybookConfig[]>([]);
  const [showPlaybook, setShowPlaybook] = useState<Record<string, boolean>>({});
  const [playbookLogs, setPlaybookLogs] = useState<Record<string, PlaybookLogEntry[]>>({});
  const [playbookStatuses, setPlaybookStatuses] = useState<Record<string, PlaybookCommandStatus[]>>(
    {},
  );
  const [playbookRunning, setPlaybookRunning] = useState<Record<string, boolean>>({});
  const [showPlaybookSelector, setShowPlaybookSelector] = useState(false);
  const sendPlaybookMessageRef = useRef<Record<string, (msg: object) => void>>({});
  const showPlaybookRef = useRef(showPlaybook);
  showPlaybookRef.current = showPlaybook;

  useEffect(() => {
    Promise.all([
      fetch('/api/sessions')
        .then((res) => (res.ok ? res.json() : []))
        .then((existing: Session[]) => {
          if (existing.length > 0) {
            setSessions(existing);
            setActiveId(existing[0].id);
          }
        })
        .catch(() => {}),
      fetch('/api/config')
        .then((res) => res.json())
        .then((cfg: { defaultDirectory?: string; playbooks?: PlaybookConfig[] }) => {
          if (cfg.defaultDirectory) setDefaultDirectory(cfg.defaultDirectory);
          if (cfg.playbooks) setPlaybooks(cfg.playbooks);
        })
        .catch(() => {}),
      fetch('/api/state')
        .then((res) => res.json())
        .then((state: { sidebarWidth?: number }) => {
          if (state.sidebarWidth !== undefined) setSidebarWidth(state.sidebarWidth);
        })
        .catch(() => {}),
    ]).then(() => setLoading(false));
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

  const handleSelectPlaybook = useCallback((playbook: PlaybookConfig) => {
    const currentId = activeIdRef.current;
    if (!currentId) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === currentId ? { ...s, playbook: playbook.name } : s)),
    );
    setShowPlaybookSelector(false);
    setShowPlaybook((prev) => ({ ...prev, [currentId]: true }));
    // Close aux when opening playbook
    if (activeShellRef.current[currentId] === 'aux') {
      setActiveShell((prev) => ({ ...prev, [currentId]: 'primary' }));
    }
    sendPlaybookMessageRef.current[currentId]?.({
      type: 'playbook:select',
      playbookName: playbook.name,
    });
    sendPlaybookMessageRef.current[currentId]?.({ type: 'playbook:replay' });
  }, []);

  const handlePlaybookStart = useCallback((sessionId: string) => {
    setPlaybookLogs((prev) => ({ ...prev, [sessionId]: [] }));
    setPlaybookRunning((prev) => ({ ...prev, [sessionId]: true }));
  }, []);

  const handlePlaybookStop = useCallback((sessionId: string) => {
    setPlaybookRunning((prev) => ({ ...prev, [sessionId]: false }));
  }, []);

  const handleReorderSessions = useCallback((reordered: Session[]) => {
    setSessions(reordered);
    fetch('/api/sessions/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: reordered.map((s) => s.id) }),
    }).catch(() => {});
  }, []);

  const handleSidebarWidthChange = useCallback((width: number) => {
    fetch('/api/state', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidebarWidth: width }),
    }).catch(() => {});
  }, []);

  const handleToggleAux = useCallback(async () => {
    const currentId = activeIdRef.current;
    if (!currentId) return;

    const session = sessionsRef.current.find((s) => s.id === currentId);
    if (!session) return;

    // Close playbook view when toggling aux
    setShowPlaybook((prev) => ({ ...prev, [currentId]: false }));

    if (!session.auxId) {
      const res = await fetch(`/api/sessions/${currentId}/aux`, { method: 'POST' });
      if (!res.ok) return;
      const aux: { id: string } = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === currentId ? { ...s, auxId: aux.id } : s)));
      setActiveShell((prev) => ({ ...prev, [currentId]: 'aux' }));
    } else {
      const switching = activeShellRef.current[currentId] === 'aux' ? 'primary' : 'aux';
      setActiveShell((prev) => ({ ...prev, [currentId]: switching }));
      // Clear idle notification when switching back to the primary shell
      if (switching === 'primary') {
        setNotificationStates((prev) => {
          if (prev[currentId] !== 'idle') return prev;
          return { ...prev, [currentId]: 'none' };
        });
      }
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
      // Clear idle/working on the tab we're switching to (unless playbook view is covering the terminal)
      if (!showPlaybookRef.current[id] && (next[id] === 'idle' || next[id] === 'working')) {
        next[id] = 'none';
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (!e.shiftKey && e.code !== 'Backslash') return;

      if (e.code === 'KeyN') {
        e.preventDefault();
        e.stopPropagation();
        if (!showPickerRef.current) setShowPicker(true);
        return;
      }

      if (e.code === 'Backslash' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (playbooks.length === 0) return;
        const currentId = activeIdRef.current;
        if (!currentId) return;
        const session = sessionsRef.current.find((s) => s.id === currentId);
        if (!session?.playbook) {
          setShowPlaybookSelector(true);
        } else {
          const opening = !showPlaybookRef.current[currentId];
          setShowPlaybook((prev) => ({ ...prev, [currentId]: opening }));
          if (opening) {
            // Close aux when opening playbook
            if (activeShellRef.current[currentId] === 'aux') {
              setActiveShell((prev) => ({ ...prev, [currentId]: 'primary' }));
            }
          } else {
            // Closing playbook — terminal is now visible, clear idle/working
            setNotificationStates((prev) => {
              const state = prev[currentId];
              if (state === 'idle' || state === 'working') {
                return { ...prev, [currentId]: 'none' };
              }
              return prev;
            });
          }
        }
        return;
      }

      if (e.code === 'Backslash' && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        handleToggleAux();
        return;
      }

      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        const tabs = sessionsRef.current;
        if (tabs.length < 2) return;
        const currentId = activeIdRef.current;
        const idx = tabs.findIndex((s) => s.id === currentId);
        if (idx === -1) return;
        const next =
          e.code === 'ArrowUp' ? (idx - 1 + tabs.length) % tabs.length : (idx + 1) % tabs.length;
        e.preventDefault();
        e.stopPropagation();
        handleSelectSession(tabs[next].id);
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
  }, [handleSelectSession, handleToggleAux, playbooks]);

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
    setPlaybookLogs((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setPlaybookStatuses((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setPlaybookRunning((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setShowPlaybook((prev) => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    delete sendPlaybookMessageRef.current[sessionId];

    fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
      .then(() => {
        // Sync order with server — the POST appended the new session at the end,
        // but the client preserved its position via the map() above.
        const currentIds = sessionsRef.current.map((s) => s.id);
        fetch('/api/sessions/reorder', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionIds: currentIds }),
        }).catch(() => {});
      })
      .catch(() => {});
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
    setPlaybookLogs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPlaybookStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPlaybookRunning((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setShowPlaybook((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    delete sendPlaybookMessageRef.current[id];
  };

  if (loading) {
    return <div className="h-full" style={{ background: uiColors.pageBg }} />;
  }

  return (
    <div
      className="animate-fade-in flex h-full"
      style={{ background: uiColors.pageBg, color: uiColors.textPrimary }}
    >
      <Sidebar
        sessions={sessions}
        activeId={activeId}
        activeShell={activeShell}
        showPlaybook={showPlaybook}
        playbookRunning={playbookRunning}
        notificationStates={notificationStates}
        onSelectSession={handleSelectSession}
        onCloseSession={handleCloseSession}
        onReorderSessions={handleReorderSessions}
        onNewTab={() => setShowPicker(true)}
        initialWidth={sidebarWidth}
        onWidthChange={handleSidebarWidthChange}
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
              showPlaybook={showPlaybook[session.id] ?? false}
              playbookName={session.playbook}
              playbookCommands={playbookStatuses[session.id]}
              playbookLogs={playbookLogs[session.id]}
              playbookRunning={playbookRunning[session.id]}
              onPlaybookStart={() => handlePlaybookStart(session.id)}
              onPlaybookStop={() => handlePlaybookStop(session.id)}
              onChangePlaybook={() => setShowPlaybookSelector(true)}
              onPlaybookOutput={(entry) => {
                setPlaybookLogs((prev) => ({
                  ...prev,
                  [session.id]: [...(prev[session.id] ?? []), entry],
                }));
              }}
              onPlaybookStatusChange={(commands) => {
                setPlaybookStatuses((prev) => ({ ...prev, [session.id]: commands }));
                const allDone = commands.every((c) => c.status !== 'running');
                if (allDone) {
                  setPlaybookRunning((prev) => ({ ...prev, [session.id]: false }));
                }
              }}
              onPlaybookStopped={() => {
                setPlaybookRunning((prev) => ({ ...prev, [session.id]: false }));
              }}
              onSendMessage={(sendFn) => {
                sendPlaybookMessageRef.current[session.id] = sendFn;
              }}
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
          <DirectoryPicker
            defaultDirectory={defaultDirectory}
            onConfirm={handleNewSession}
            onCancel={() => setShowPicker(false)}
          />
        )}

        {showPlaybookSelector && (
          <PlaybookSelector
            playbooks={playbooks}
            onSelect={handleSelectPlaybook}
            onCancel={() => setShowPlaybookSelector(false)}
          />
        )}
      </div>
    </div>
  );
}
