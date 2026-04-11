import type { Session } from '../types';
import TabItem from './TabItem';

interface SidebarProps {
  sessions: Session[];
  activeId: string | null;
  onSelectSession: (id: string) => void;
  onCloseSession: (id: string) => void;
  onNewTab: () => void;
}

export default function Sidebar({
  sessions,
  activeId,
  onSelectSession,
  onCloseSession,
  onNewTab,
}: SidebarProps) {
  return (
    <div className="w-60 min-w-60 bg-white/[0.03] border-r border-white/[0.06] flex flex-col">
      <div className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
        {sessions.map((session) => (
          <TabItem
            key={session.id}
            session={session}
            isActive={session.id === activeId}
            onClick={() => onSelectSession(session.id)}
            onClose={() => onCloseSession(session.id)}
          />
        ))}
      </div>
      <div className="p-2 border-t border-white/[0.06]">
        <button
          onClick={onNewTab}
          className="w-full p-2.5 rounded-[10px] text-center text-sm text-white/30 border border-dashed border-white/[0.08] hover:border-white/20 hover:text-white/50 transition-all"
        >
          + New tab
        </button>
      </div>
    </div>
  );
}
