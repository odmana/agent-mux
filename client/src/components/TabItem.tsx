import { Play } from 'lucide-react';
import { useState } from 'react';

import { uiColors } from '../terminal-config';
import type { Session, NotificationState } from '../types';
import Kbd from './Kbd';

interface TabItemProps {
  session: Session;
  isActive: boolean;
  isAuxActive: boolean;
  isPlaybookActive: boolean;
  isPlaybookRunning: boolean;
  notificationState: NotificationState;
  index: number;
  onClick: () => void;
  onClose: () => void;
}

export default function TabItem({
  session,
  isActive,
  isAuxActive,
  isPlaybookActive,
  isPlaybookRunning,
  notificationState,
  index,
  onClick,
  onClose,
}: TabItemProps) {
  const [confirming, setConfirming] = useState(false);
  const displayName =
    session.directory
      .replace(/[\\/]+$/, '')
      .split(/[\\/]/)
      .pop() || session.directory;

  // Green/red dots: all tabs. Blue dots: background tabs only
  // (or when the terminal is obscured by aux/playbook view).
  const terminalObscured = isAuxActive || isPlaybookActive;
  const showDot =
    (notificationState === 'idle' && (!isActive || terminalObscured)) ||
    notificationState === 'working' ||
    notificationState === 'permission';
  const dotColor =
    notificationState === 'permission'
      ? uiColors.notificationPermission
      : notificationState === 'working'
        ? uiColors.notificationWorking
        : uiColors.notificationIdle;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-lg px-3 py-2.5 transition-all"
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
          <span className="text-xs" style={{ color: uiColors.textMuted }}>
            Close session?
          </span>
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded px-2 py-0.5 text-xs transition-colors"
              style={{ background: uiColors.dangerBg, color: uiColors.dangerText }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = uiColors.dangerHoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = uiColors.dangerBg;
              }}
            >
              Yes
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(false);
              }}
              className="rounded px-2 py-0.5 text-xs transition-colors"
              style={{ background: uiColors.activeBg, color: uiColors.textMuted }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = uiColors.activeBorder;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = uiColors.activeBg;
              }}
            >
              No
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {showDot && (
                <span
                  className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: dotColor,
                    boxShadow: `0 0 6px ${dotColor}, 0 0 2px ${dotColor}`,
                    animation:
                      notificationState === 'permission'
                        ? 'pulse-glow 2s ease-in-out infinite'
                        : undefined,
                  }}
                />
              )}
              <span
                className="truncate text-sm font-medium"
                style={{ color: isActive ? uiColors.textPrimary : uiColors.textMuted }}
                title={session.directory}
              >
                {displayName}
              </span>
              {isAuxActive && (
                <span
                  className="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] leading-none font-bold uppercase"
                  style={{
                    background: 'rgba(129, 161, 193, 0.15)',
                    color: uiColors.accent,
                    border: '1px solid rgba(129, 161, 193, 0.25)',
                  }}
                >
                  aux
                </span>
              )}
              {isPlaybookActive && (
                <span
                  className="shrink-0 rounded px-1 py-0.5 font-mono text-[9px] leading-none font-bold uppercase"
                  style={{
                    background: 'rgba(163, 190, 140, 0.15)',
                    color: '#a3be8c',
                    border: '1px solid rgba(163, 190, 140, 0.25)',
                  }}
                >
                  play
                </span>
              )}
              {isPlaybookRunning && (
                <Play size={10} className="shrink-0" style={{ color: '#a3be8c' }} />
              )}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(true);
              }}
              className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded text-xs opacity-0 transition-all group-hover:opacity-100"
              style={{ color: uiColors.textDim }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = uiColors.textMuted;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = uiColors.textDim;
              }}
            >
              ×
            </button>
          </div>
          <div className="mt-1 flex items-center gap-1">
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
              className="font-mono text-xs tracking-wide uppercase"
              style={{ color: isActive ? uiColors.textMuted : uiColors.textDim }}
            >
              {session.branch || 'not git tracked'}
            </span>
            {index < 9 && <Kbd className="ml-auto shrink-0">{index + 1}</Kbd>}
          </div>
        </>
      )}
    </div>
  );
}
