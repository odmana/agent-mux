import { Play, Square, SquareChevronRight } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { uiColors } from '../terminal-config';
import type { Session } from '../types';

const SHOW_DELAY_MS = 400;
const HIDE_DELAY_MS = 150;
const ESTIMATED_HEIGHT = 180;

export interface HoveredTab {
  session: Session;
  isPlaybookRunning: boolean;
  anchorRect: DOMRect;
}

export interface TabHoverPopoverHandle {
  close: () => void;
}

interface TabHoverPopoverProps {
  // The tab the cursor is currently over, or null if no tab is hovered.
  // The popover manages its own show/hide delays based on changes to this.
  hoveredTab: HoveredTab | null;
  hasPlaybooks: boolean;
  onOpenPrimary: (sessionId: string) => void;
  onOpenAux: (sessionId: string) => void;
  onOpenPlaybook: (sessionId: string) => void;
  onStart: (sessionId: string) => void;
  onStop: (sessionId: string) => void;
}

const TabHoverPopover = forwardRef<TabHoverPopoverHandle, TabHoverPopoverProps>(
  function TabHoverPopover(
    { hoveredTab, hasPlaybooks, onOpenPrimary, onOpenAux, onOpenPlaybook, onStart, onStop },
    ref,
  ) {
    // `displayed` is what's actually rendered. It lags `hoveredTab` by the
    // show-delay on the way in and the hide-delay on the way out, so the
    // popover stays put long enough for the cursor to reach it.
    const [displayed, setDisplayed] = useState<HoveredTab | null>(null);
    const displayedRef = useRef<HoveredTab | null>(null);
    displayedRef.current = displayed;
    const hoveredRef = useRef<HoveredTab | null>(null);
    hoveredRef.current = hoveredTab;
    const showTimerRef = useRef<number | null>(null);
    const hideTimerRef = useRef<number | null>(null);

    const cancelShow = () => {
      if (showTimerRef.current !== null) {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = null;
      }
    };
    const cancelHide = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
    const scheduleHide = () => {
      cancelHide();
      hideTimerRef.current = window.setTimeout(() => {
        setDisplayed(null);
        hideTimerRef.current = null;
      }, HIDE_DELAY_MS);
    };

    useImperativeHandle(ref, () => ({
      close: () => {
        cancelShow();
        cancelHide();
        setDisplayed(null);
      },
    }));

    useEffect(() => {
      if (hoveredTab) {
        cancelHide();
        if (displayedRef.current) {
          // Already visible — refresh content (covers session swaps and rect updates).
          setDisplayed(hoveredTab);
        } else if (showTimerRef.current === null) {
          // Not visible and nothing pending — start the show delay. Don't reset
          // an in-flight timer, otherwise resizes or sibling re-renders while
          // the user lingers would restart the countdown.
          showTimerRef.current = window.setTimeout(() => {
            setDisplayed(hoveredRef.current);
            showTimerRef.current = null;
          }, SHOW_DELAY_MS);
        }
      } else {
        cancelShow();
        if (displayedRef.current) scheduleHide();
      }
    }, [hoveredTab]);

    useEffect(
      () => () => {
        cancelShow();
        cancelHide();
      },
      [],
    );

    if (!displayed) return null;

    const { session, isPlaybookRunning, anchorRect } = displayed;
    const playbookDisabled = !session.playbook && !hasPlaybooks;
    const left = anchorRect.right + 8;
    const top = Math.max(8, Math.min(anchorRect.top, window.innerHeight - ESTIMATED_HEIGHT - 8));

    const dismissAndRun = (action: () => void) => {
      cancelShow();
      cancelHide();
      setDisplayed(null);
      action();
    };

    return createPortal(
      <div
        onMouseEnter={cancelHide}
        onMouseLeave={() => {
          // Only hide if the cursor hasn't landed on a tab; otherwise the
          // tab's hover update will keep us open.
          if (!hoveredRef.current) scheduleHide();
        }}
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
          onClick={() => dismissAndRun(() => onOpenPrimary(session.id))}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: uiColors.pageBg,
            color: uiColors.textPrimary,
            border: `1px solid ${uiColors.activeBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = uiColors.activeBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = uiColors.pageBg;
          }}
        >
          Primary Terminal
        </button>

        <button
          onClick={() => dismissAndRun(() => onOpenAux(session.id))}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            background: uiColors.accentBg,
            color: uiColors.accent,
            border: `1px solid ${uiColors.accentBorder}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = uiColors.accentHoverBg;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = uiColors.accentBg;
          }}
        >
          Aux Terminal
        </button>

        <div className="flex items-stretch gap-1.5">
          <button
            onClick={() => dismissAndRun(() => onOpenPlaybook(session.id))}
            disabled={playbookDisabled}
            title={playbookDisabled ? 'No playbooks configured' : undefined}
            className="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: uiColors.successBg,
              color: uiColors.success,
              border: `1px solid ${uiColors.successBorder}`,
            }}
            onMouseEnter={(e) => {
              if (!playbookDisabled) e.currentTarget.style.background = uiColors.successHoverBg;
            }}
            onMouseLeave={(e) => {
              if (!playbookDisabled) e.currentTarget.style.background = uiColors.successBg;
            }}
          >
            Playbook
          </button>
          {session.playbook && (
            <button
              onClick={() => (isPlaybookRunning ? onStop(session.id) : onStart(session.id))}
              aria-label={isPlaybookRunning ? 'Stop playbook' : 'Start playbook'}
              className="flex shrink-0 items-center justify-center rounded-md px-2 transition-colors"
              style={{
                background: isPlaybookRunning ? uiColors.dangerBg : uiColors.successBg,
                color: isPlaybookRunning ? uiColors.dangerText : uiColors.success,
                border: `1px solid ${
                  isPlaybookRunning ? uiColors.dangerBorder : uiColors.successBorder
                }`,
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
  },
);

export default TabHoverPopover;
