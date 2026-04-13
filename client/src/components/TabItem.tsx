import { useState } from 'react';
import type { Session, NotificationState } from '../types';
import { uiColors } from '../terminal-config';

interface TabItemProps {
  session: Session;
  isActive: boolean;
  notificationState: NotificationState;
  onClick: () => void;
  onClose: () => void;
}

export default function TabItem({ session, isActive, notificationState, onClick, onClose }: TabItemProps) {
  const [confirming, setConfirming] = useState(false);
  const displayName = session.directory.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || session.directory;

  // Blue dots: background tabs only. Red dots: all tabs.
  const showDot =
    (notificationState === 'idle' && !isActive) ||
    notificationState === 'permission';
  const dotColor = notificationState === 'permission'
    ? uiColors.notificationPermission
    : uiColors.notificationIdle;

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
            <div className="flex items-center gap-1.5 min-w-0">
              {showDot && (
                <span
                  className="shrink-0 inline-block w-2 h-2 rounded-full"
                  style={{
                    background: dotColor,
                    boxShadow: `0 0 6px ${dotColor}, 0 0 2px ${dotColor}`,
                    animation: notificationState === 'permission' ? 'pulse-glow 2s ease-in-out infinite' : undefined,
                  }}
                />
              )}
              <span
                className="text-[13px] font-medium truncate"
                style={{ color: isActive ? uiColors.textPrimary : uiColors.textMuted }}
                title={session.directory}
              >
                {displayName}
              </span>
            </div>
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
          <div className="flex items-center gap-1 mt-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              style={{ color: uiColors.textDim, flexShrink: 0 }}
            >
              <circle cx="4" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="4" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5.5V10.5" stroke="currentColor" strokeWidth="1.2" />
              <path d="M4 5.5C4 8 6 8 12 5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
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
