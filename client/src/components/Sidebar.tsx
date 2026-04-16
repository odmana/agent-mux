import { useState, useCallback, useRef } from 'react';

import { uiColors } from '../terminal-config';
import type { Session, NotificationState } from '../types';
import Kbd from './Kbd';
import TabItem from './TabItem';

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  activeShell: Record<string, 'primary' | 'aux'>;
  showPlaybook: Record<string, boolean>;
  notificationStates: Record<string, NotificationState>;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onReorderSessions: (sessions: Session[]) => void;
  onNewTab: () => void;
  initialWidth?: number;
  onWidthChange?: (width: number) => void;
}

export default function Sidebar({
  sessions,
  activeId,
  activeShell,
  showPlaybook,
  notificationStates,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onNewTab,
  initialWidth,
  onWidthChange,
}: SidebarProps) {
  const [width, setWidth] = useState(initialWidth ?? DEFAULT_WIDTH);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
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
    [onWidthChange],
  );

  const handleDragStart = (index: number) => {
    setDragIndex(index);
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

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2">
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
              notificationState={notificationStates[session.id] ?? 'none'}
              index={index}
              onClick={() => onSelectSession(session.id)}
              onClose={() => onCloseSession(session.id)}
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
    </div>
  );
}
