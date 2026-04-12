import { useState } from 'react';
import type { Session } from '../types';

interface TabItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export default function TabItem({ session, isActive, onClick, onClose }: TabItemProps) {
  const [confirming, setConfirming] = useState(false);
  const displayPath = session.directory.replace(/^\/Users\/\w+/, '~');

  return (
    <div
      onClick={onClick}
      className={`group px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
        isActive
          ? 'bg-white/[0.07] border border-white/[0.1]'
          : 'border border-transparent hover:bg-white/[0.04]'
      }`}
    >
      {confirming ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-white/50">Close session?</span>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="px-2 py-0.5 rounded text-[11px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
              className="px-2 py-0.5 rounded text-[11px] bg-white/[0.06] text-white/40 hover:bg-white/[0.1] transition-colors"
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <span
              className={`text-[13px] font-medium truncate ${isActive ? 'text-[#e4e4e7]' : 'text-white/50'}`}
              title={session.directory}
            >
              {displayPath}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              className="shrink-0 text-white/0 group-hover:text-white/25 hover:!text-white/50 text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded transition-all"
            >
              ×
            </button>
          </div>
          <div className={`flex items-center gap-1.5 mt-1 text-[11px] ${isActive ? 'text-white/35' : 'text-white/20'}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${session.branch ? 'bg-amber-500' : 'bg-white/20'}`} />
            <span className="uppercase tracking-wide text-[10px]">
              {session.branch || 'not git tracked'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
