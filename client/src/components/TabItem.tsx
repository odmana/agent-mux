import { useState } from 'react';
import type { Session } from '../types';
import { uiColors } from '../terminal-config';

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
      className="group px-3 py-2.5 rounded-lg cursor-pointer transition-all"
      style={{
        background: isActive ? uiColors.activeBg : 'transparent',
        border: `1px solid ${isActive ? uiColors.activeBorder : 'transparent'}`,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = uiColors.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      {confirming ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px]" style={{ color: uiColors.textMuted }}>Close session?</span>
          <div className="flex gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="px-2 py-0.5 rounded text-[11px] transition-colors"
              style={{ background: uiColors.dangerBg, color: uiColors.dangerText }}
              onMouseEnter={(e) => { e.currentTarget.style.background = uiColors.dangerHoverBg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = uiColors.dangerBg; }}
            >
              Yes
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(false); }}
              className="px-2 py-0.5 rounded text-[11px] transition-colors"
              style={{ background: uiColors.activeBg, color: uiColors.textMuted }}
              onMouseEnter={(e) => { e.currentTarget.style.background = uiColors.activeBorder; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = uiColors.activeBg; }}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <span
              className="text-[13px] font-medium truncate"
              style={{ color: isActive ? uiColors.textPrimary : uiColors.textMuted }}
              title={session.directory}
            >
              {displayPath}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
              className="shrink-0 text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded transition-all opacity-0 group-hover:opacity-100"
              style={{ color: uiColors.textDim }}
              onMouseEnter={(e) => { e.currentTarget.style.color = uiColors.textMuted; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = uiColors.textDim; }}
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px]">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: session.branch ? uiColors.branchDot : uiColors.textDim }}
            />
            <span
              className="uppercase tracking-wide text-[10px]"
              style={{ color: isActive ? uiColors.textMuted : uiColors.textDim }}
            >
              {session.branch || 'not git tracked'}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
