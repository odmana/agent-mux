import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

import { uiColors } from '../terminal-config';
import type { Session, NotificationState } from '../types';
import Kbd from './Kbd';
import type { PlaybookPending } from './PlaybookToggleButton';
import TabHoverPopover, { type HoveredTab, type TabHoverPopoverHandle } from './TabHoverPopover';
import TabItem from './TabItem';

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  activeShell: Record<string, 'primary' | 'aux'>;
  showPlaybook: Record<string, boolean>;
  playbookRunning: Record<string, boolean>;
  playbookPending: Record<string, PlaybookPending>;
  notificationStates: Record<string, NotificationState>;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onReorderSessions: (sessions: Session[]) => void;
  onNewTab: () => void;
  hasPlaybooks: boolean;
  onOpenPrimaryForTab: (sessionId: string) => void;
  onOpenAuxForTab: (sessionId: string) => void;
  onOpenPlaybookForTab: (sessionId: string) => void;
  onStartPlaybookForTab: (sessionId: string) => void;
  onStopPlaybookForTab: (sessionId: string) => void;
  initialWidth?: number;
  onWidthChange?: (width: number) => void;
}

interface HoverState {
  sessionId: string;
  element: HTMLDivElement;
}

export default function Sidebar({
  sessions,
  activeId,
  activeShell,
  showPlaybook,
  playbookRunning,
  playbookPending,
  notificationStates,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onNewTab,
  hasPlaybooks,
  onOpenPrimaryForTab,
  onOpenAuxForTab,
  onOpenPlaybookForTab,
  onStartPlaybookForTab,
  onStopPlaybookForTab,
  initialWidth,
  onWidthChange,
}: SidebarProps) {
  const [width, setWidth] = useState(initialWidth ?? DEFAULT_WIDTH);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);
  const [repositionKey, setRepositionKey] = useState(0);
  const popoverRef = useRef<TabHoverPopoverHandle | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const hideImmediately = useCallback(() => {
    setHover(null);
    popoverRef.current?.close();
  }, []);

  const handleTabHoverStart = useCallback((sessionId: string, element: HTMLDivElement) => {
    setHover({ sessionId, element });
  }, []);

  const handleTabHoverEnd = useCallback(() => {
    setHover(null);
  }, []);

  useEffect(() => {
    if (!hover) return;
    const reposition = () => setRepositionKey((n) => n + 1);
    window.addEventListener('resize', reposition);
    return () => window.removeEventListener('resize', reposition);
  }, [hover]);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      hideImmediately();
      const startX = e.clientX;
      const startWidth = widthRef.current;
      document.body.style.userSelect = 'none';

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + ev.clientX - startX));
        setWidth(newWidth);
      };
      const onMouseUp = () => {
        document.body.style.userSelect = '';
        onWidthChange?.(widthRef.current);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [hideImmediately, onWidthChange],
  );

  const handleDragStart = (index: number) => {
    setDragIndex(index);
    hideImmediately();
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    const reordered = [...sessions];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(index, 0, moved);
    onReorderSessions(reordered);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const hoveredSession = hover ? sessions.find((s) => s.id === hover.sessionId) : null;
  const hoveredTab = useMemo<HoveredTab | null>(
    () => {
      if (!hover || !hoveredSession) return null;
      return {
        session: hoveredSession,
        anchorRect: hover.element.getBoundingClientRect(),
      };
    },
    // repositionKey is the signal to re-read the rect after a window resize.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [hover, hoveredSession, repositionKey],
  );

  return (
    <div
      className="relative flex flex-col"
      style={{
        width,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        background: uiColors.sidebarBg,
        borderRight: `1px solid ${uiColors.sidebarBorder}`,
      }}
    >
      <div className="px-4 pt-5 pb-2">
        <h2
          className="text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ color: uiColors.textDim }}
        >
          Terminal Sessions
        </h2>
      </div>

      <div
        onScroll={hideImmediately}
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2"
      >
        {sessions.map((session, index) => (
          <div
            key={session.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`transition-opacity ${dragIndex === index ? 'opacity-30' : ''}`}
            style={{
              borderTop: `2px solid ${
                overIndex === index && dragIndex !== index ? uiColors.accent : 'transparent'
              }`,
            }}
          >
            <TabItem
              session={session}
              isActive={session.id === activeId}
              isAuxActive={activeShell[session.id] === 'aux'}
              isPlaybookActive={showPlaybook[session.id] ?? false}
              isPlaybookRunning={playbookRunning[session.id] ?? false}
              notificationState={notificationStates[session.id] ?? 'none'}
              index={index}
              onClick={() => onSelectSession(session.id)}
              onClose={() => onCloseSession(session.id)}
              onHoverStart={(el) => handleTabHoverStart(session.id, el)}
              onHoverEnd={handleTabHoverEnd}
            />
          </div>
        ))}
      </div>

      <div className="p-2">
        <button
          onClick={onNewTab}
          className="flex w-full items-center justify-center gap-2 rounded-lg p-2.5 text-sm transition-all"
          style={{
            color: uiColors.textDim,
            border: `1px dashed ${uiColors.sidebarBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = uiColors.textMuted;
            e.currentTarget.style.color = uiColors.textMuted;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = uiColors.sidebarBorder;
            e.currentTarget.style.color = uiColors.textDim;
          }}
        >
          <span className="text-base leading-none">+</span>
          New session
          <Kbd className="ml-auto">N</Kbd>
        </button>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize transition-colors hover:bg-white/10"
      />

      <TabHoverPopover
        ref={popoverRef}
        hoveredTab={hoveredTab}
        playbookRunning={playbookRunning}
        playbookPending={playbookPending}
        hasPlaybooks={hasPlaybooks}
        onOpenPrimary={onOpenPrimaryForTab}
        onOpenAux={onOpenAuxForTab}
        onOpenPlaybook={onOpenPlaybookForTab}
        onStart={onStartPlaybookForTab}
        onStop={onStopPlaybookForTab}
      />
    </div>
  );
}
