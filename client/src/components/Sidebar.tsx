import { useState } from 'react';
import type { Session } from '../types';
import TabItem from './TabItem';
import { uiColors } from '../terminal-config';

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onReorderSessions: (sessions: Session[]) => void;
  onNewTab: () => void;
}

export default function Sidebar({
  sessions,
  activeId,
  onSelectSession,
  onCloseSession,
  onReorderSessions,
  onNewTab,
}: SidebarProps) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

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
      className="w-60 min-w-60 flex flex-col"
      style={{ background: uiColors.sidebarBg, borderRight: `1px solid ${uiColors.sidebarBorder}` }}
    >
      <div className="px-4 pt-5 pb-2">
        <h2
          className="text-[11px] font-semibold tracking-[0.12em] uppercase"
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
        </button>
      </div>
    </div>
  );
}
