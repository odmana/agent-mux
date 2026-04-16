import { Play, Square, SquareChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';

import { uiColors } from '../terminal-config';
import type { Session } from '../types';

interface TabHoverPopoverProps {
  session: Session;
  isPlaybookRunning: boolean;
  hasPlaybooks: boolean;
  anchorRect: DOMRect;
  onOpenAux: () => void;
  onOpenPlaybook: () => void;
  onStart: () => void;
  onStop: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const BLUE_BG = 'rgba(129, 161, 193, 0.2)';
const BLUE_BG_HOVER = 'rgba(129, 161, 193, 0.32)';
const BLUE_BORDER = 'rgba(129, 161, 193, 0.35)';
const GREEN = '#a3be8c';
const GREEN_BG = 'rgba(163, 190, 140, 0.2)';
const GREEN_BG_HOVER = 'rgba(163, 190, 140, 0.32)';
const GREEN_BORDER = 'rgba(163, 190, 140, 0.35)';
const ESTIMATED_HEIGHT = 140;

export default function TabHoverPopover({
  session,
  isPlaybookRunning,
  hasPlaybooks,
  anchorRect,
  onOpenAux,
  onOpenPlaybook,
  onStart,
  onStop,
  onMouseEnter,
  onMouseLeave,
}: TabHoverPopoverProps) {
  const playbookDisabled = !session.playbook && !hasPlaybooks;
  const left = anchorRect.right + 8;
  const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - ESTIMATED_HEIGHT - 8));

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="flex flex-col gap-1.5 rounded-lg p-2 shadow-lg"
      style={{
        position: 'fixed',
        top,
        left,
        width: 200,
        background: uiColors.sidebarBg,
        border: `1px solid ${uiColors.activeBorder}`,
        zIndex: 50,
      }}
    >
      <button
        onClick={onOpenAux}
        className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: BLUE_BG,
          color: uiColors.accent,
          border: `1px solid ${BLUE_BORDER}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = BLUE_BG_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = BLUE_BG;
        }}
      >
        Aux Terminal
      </button>

      <div className="flex items-stretch gap-1.5">
        <button
          onClick={onOpenPlaybook}
          disabled={playbookDisabled}
          title={playbookDisabled ? 'No playbooks configured' : undefined}
          className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: GREEN_BG,
            color: GREEN,
            border: `1px solid ${GREEN_BORDER}`,
          }}
          onMouseEnter={(e) => {
            if (!playbookDisabled) e.currentTarget.style.background = GREEN_BG_HOVER;
          }}
          onMouseLeave={(e) => {
            if (!playbookDisabled) e.currentTarget.style.background = GREEN_BG;
          }}
        >
          Playbook
        </button>
        {session.playbook && (
          <button
            onClick={isPlaybookRunning ? onStop : onStart}
            aria-label={isPlaybookRunning ? 'Stop playbook' : 'Start playbook'}
            className="flex shrink-0 items-center justify-center rounded-md px-2 transition-colors"
            style={{
              background: isPlaybookRunning ? uiColors.dangerBg : GREEN_BG,
              color: isPlaybookRunning ? uiColors.dangerText : GREEN,
              border: `1px solid ${isPlaybookRunning ? 'rgba(191, 97, 106, 0.35)' : GREEN_BORDER}`,
            }}
          >
            {isPlaybookRunning ? <Square size={12} /> : <Play size={12} />}
          </button>
        )}
      </div>

      {session.playbook && (
        <div
          className="flex items-center gap-1 px-1 text-[11px]"
          style={{ color: uiColors.textMuted }}
          title={session.playbook}
        >
          <SquareChevronRight size={12} className="shrink-0" />
          <span className="truncate">{session.playbook}</span>
        </div>
      )}
    </div>,
    document.body,
  );
}
