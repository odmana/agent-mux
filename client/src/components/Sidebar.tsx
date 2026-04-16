import { useState, useCallback, useRef, useEffect } from 'react';

import { uiColors } from '../terminal-config';
import type { Session, NotificationState } from '../types';
import Kbd from './Kbd';
import TabHoverPopover from './TabHoverPopover';
import TabItem from './TabItem';

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;
const HIDE_DELAY_MS = 150;

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  activeShell: Record<string, 'primary' | 'aux'>;
  showPlaybook: Record<string, boolean>;
  playbookRunning: Record<string, boolean>;
  notificationStates: Record<string, NotificationState>;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onReorderSessions: (sessions: Session[]) => void;
  onNewTab: () => void;
  hasPlaybooks: boolean;
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
  rect: DOMRect;
}

export default function Sidebar({
  sessions,
  activeId,
  activeShell,
  showPlaybook,
  playbookRunning,
  notificationStates,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onNewTab,
  hasPlaybooks,
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
  const hideTimerRef = useRef<number | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      setHover(null);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [cancelHide]);

  const hideImmediately = useCallback(() => {
    cancelHide();
    setHover(null);
  }, [cancelHide]);

  const handleTabHoverStart = useCallback(
    (sessionId: string, element: HTMLDivElement) => {
      cancelHide();
      setHover({ sessionId, element, rect: element.getBoundingClientRect() });
    },
    [cancelHide],
  );

  useEffect(() => () => cancelHide(), [cancelHide]);

  useEffect(() => {
    if (!hover) return;
    const reposition = () => {
      setHover((prev) => (prev ? { ...prev, rect: prev.element.getBoundingClientRect() } : null));
    };
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
              onHoverEnd={scheduleHide}
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

      {hover && hoveredSession && (
        <TabHoverPopover
          session={hoveredSession}
          isPlaybookRunning={playbookRunning[hoveredSession.id] ?? false}
          hasPlaybooks={hasPlaybooks}
          anchorRect={hover.rect}
          onOpenAux={() => {
            hideImmediately();
            onOpenAuxForTab(hoveredSession.id);
          }}
          onOpenPlaybook={() => {
            hideImmediately();
            onOpenPlaybookForTab(hoveredSession.id);
          }}
          onStart={() => onStartPlaybookForTab(hoveredSession.id)}
          onStop={() => onStopPlaybookForTab(hoveredSession.id)}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  );
}
