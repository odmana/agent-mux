import { useState } from 'react';
import type { Session } from './types';

export default function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <div className="h-full flex bg-[#0c0c0c] text-[#e4e4e7] font-sans">
      {/* Sidebar */}
      <div className="w-60 min-w-60 bg-white/[0.03] border-r border-white/[0.06] flex flex-col">
        <div className="flex-1 p-2 flex flex-col gap-0.5 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="text-white/30 text-sm p-3">No sessions</p>
          )}
        </div>
        <div className="p-2 border-t border-white/[0.06]">
          <button className="w-full p-2.5 rounded-[10px] text-center text-sm text-white/30 border border-dashed border-white/[0.08] hover:border-white/20 hover:text-white/50 transition-all">
            + New tab
          </button>
        </div>
      </div>

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
