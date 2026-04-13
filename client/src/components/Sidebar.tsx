import { useState, useCallback, useRef } from 'react';
import type { Session, NotificationState } from '../types';
import TabItem from './TabItem';
import { uiColors } from '../terminal-config';
import Kbd from './Kbd';

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 240;
const STORAGE_KEY = 'sidebar-width';

function loadWidth(): number {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
  }
  return DEFAULT_WIDTH;
}

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  notificationStates: Record<string, NotificationState>;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onReorderSessions: (sessions: Session[]) => void;
  onNewTab: () => void;
}

export default function Sidebar({
  sessions,
  activeId,
  notificationStates,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onNewTab,
}: SidebarProps) {
  const [width, setWidth] = useState(loadWidth);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
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
      localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

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
      className="flex flex-col relative"
      style={{ width, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH, background: uiColors.sidebarBg, borderRight: `1px solid ${uiColors.sidebarBorder}` }}
    >
      <div className="px-4 pt-5 pb-2">
        <h2
          className="text-xs font-semibold tracking-[0.12em] uppercase"
          style={{ color: uiColors.textDim }}
        >
          Terminal Sessions
        </h2>
      </div>

      <div className="flex-1 px-2 pb-2 flex flex-col gap-1 overflow-y-auto">
        {sessions.map((session, index) => (
          <div
            key={session.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`transition-opacity ${
              dragIndex === index ? 'opacity-30' : ''
            }`}
            style={{
              borderTop: `2px solid ${
                overIndex === index && dragIndex !== index
                  ? uiColors.accent
                  : 'transparent'
              }`,
            }}
          >
            <TabItem
              session={session}
              isActive={session.id === activeId}
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
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg text-sm transition-all"
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
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-white/10 transition-colors"
      />
    </div>
  );
}
