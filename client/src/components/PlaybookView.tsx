import AnsiToHtml from 'ansi-to-html';
import { SquareChevronRight } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';

import { uiColors } from '../terminal-config';
import type { PlaybookCommandStatus, PlaybookLogEntry } from '../types';
import PlaybookToggleButton, { type PlaybookPending } from './PlaybookToggleButton';
import ScrollArea from './ScrollArea';

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

const ansiConverter = new AnsiToHtml({
  fg: '#d8dee9',
  bg: 'transparent',
  escapeXML: true,
});

// Distinct colors for command labels
const LABEL_COLORS = [
  '#81a1c1', // blue
  '#a3be8c', // green
  '#ebcb8b', // yellow
  '#b48ead', // magenta
  '#88c0d0', // cyan
  '#bf616a', // red
  '#d08770', // orange
  '#5e81ac', // dark blue
];

interface PlaybookViewProps {
  playbookName: string;
  commands: PlaybookCommandStatus[];
  logs: PlaybookLogEntry[];
  isRunning: boolean;
  pending?: PlaybookPending;
  startedAt: number | null;
  onStart: () => void;
  onStop: () => void;
  onChangePlaybook: () => void;
}

export default function PlaybookView({
  playbookName,
  commands,
  logs,
  isRunning,
  pending,
  startedAt,
  onStart,
  onStop,
  onChangePlaybook,
}: PlaybookViewProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(commands.map((c) => c.label)),
  );
  const [, forceTick] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // Keep a 1s interval alive whenever the playbook is running so elapsed time
  // stays fresh. We read `Date.now()` directly at render; the tick just forces
  // the component to re-render.
  useEffect(() => {
    if (startedAt === null) return;
    const id = window.setInterval(() => forceTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  // Swallow the scroll event that our own programmatic scroll generates —
  // otherwise a burst of new logs (common on Windows where child stdout arrives
  // in large chunks) can race the async scroll event and read stale scrollTop
  // against fresh scrollHeight, flipping atBottom to false and disabling tail-follow.
  const suppressNextScrollEvent = useRef(false);
  const [showJumpToTail, setShowJumpToTail] = useState(false);

  // Update filters when commands change (new playbook selected)
  const commandLabelsKey = useMemo(() => commands.map((c) => c.label).join(','), [commands]);
  useEffect(() => {
    setActiveFilters(new Set(commands.map((c) => c.label)));
  }, [commandLabelsKey, commands]);

  // Auto-scroll to bottom when new logs arrive. Layout effect so it runs after DOM
  // commit but before paint, avoiding a race where the next log appends before this fires.
  useLayoutEffect(() => {
    const el = logContainerRef.current;
    if (isAtBottomRef.current && el) {
      suppressNextScrollEvent.current = true;
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  const handleScroll = useCallback(() => {
    if (suppressNextScrollEvent.current) {
      suppressNextScrollEvent.current = false;
      return;
    }
    const el = logContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAtBottomRef.current = atBottom;
    setShowJumpToTail(!atBottom);
  }, []);

  const jumpToTail = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    suppressNextScrollEvent.current = true;
    el.scrollTop = el.scrollHeight;
    isAtBottomRef.current = true;
    setShowJumpToTail(false);
  }, []);

  const selectOnlyFilter = (label: string) => {
    setActiveFilters(new Set([label]));
  };

  const labelColorMap = new Map<string, string>();
  commands.forEach((cmd, i) => {
    labelColorMap.set(cmd.label, LABEL_COLORS[i % LABEL_COLORS.length]);
  });

  const filteredLogs = logs.filter((log) => activeFilters.has(log.source));
  const allFiltersActive = commands.length > 0 && activeFilters.size === commands.length;
  const setAllFilters = () => setActiveFilters(new Set(commands.map((c) => c.label)));
  const elapsedMs = startedAt === null ? 0 : Date.now() - startedAt;

  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: uiColors.pageBg }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: uiColors.sidebarBorder }}
      >
        {/* Playbook card \u2014 clicking opens the selector */}
        <button
          type="button"
          onClick={onChangePlaybook}
          title="Change playbook"
          className="flex h-11 shrink-0 items-center gap-2.5 rounded-lg border px-3 text-left transition-colors"
          style={{
            backgroundColor: uiColors.sidebarBg,
            borderColor: uiColors.sidebarBorder,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = uiColors.hoverBg;
            e.currentTarget.style.borderColor = uiColors.activeBorder;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = uiColors.sidebarBg;
            e.currentTarget.style.borderColor = uiColors.sidebarBorder;
          }}
        >
          <SquareChevronRight size={20} className="shrink-0" style={{ color: uiColors.success }} />
          <span className="flex min-w-0 flex-col leading-tight">
            <span
              className="text-[10px] tracking-[0.12em] uppercase"
              style={{ color: uiColors.textMuted }}
            >
              Playbook
            </span>
            <span
              className="max-w-[240px] truncate text-sm font-medium"
              style={{ color: uiColors.textPrimary }}
            >
              {playbookName}
            </span>
          </span>
        </button>

        {/* Status pill */}
        {pending === 'starting' && (
          <div
            className="flex h-7 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium"
            style={{
              borderColor: uiColors.successBorder,
              backgroundColor: uiColors.successBg,
              color: uiColors.success,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: uiColors.success }}
            />
            <span>{'Starting\u2026'}</span>
          </div>
        )}
        {pending === 'stopping' && (
          <div
            className="flex h-7 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium"
            style={{
              borderColor: uiColors.dangerBorder,
              backgroundColor: uiColors.dangerBg,
              color: uiColors.dangerText,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: uiColors.dangerText }}
            />
            <span>{'Stopping\u2026'}</span>
          </div>
        )}
        {isRunning && pending === undefined && (
          <div
            className="flex h-7 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium"
            style={{
              borderColor: uiColors.successBorder,
              backgroundColor: uiColors.successBg,
              color: uiColors.success,
            }}
          >
            <span
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: uiColors.success }}
            />
            <span>{`Running \u00b7 ${formatElapsed(elapsedMs)}`}</span>
          </div>
        )}

        {/* Spacer */}
        <div className="min-w-0 flex-1" />

        {/* Filter chips */}
        {commands.length > 0 && (
          <div
            className="flex shrink-0 items-center gap-0.5 rounded-full border p-0.5"
            style={{
              backgroundColor: uiColors.sidebarBg,
              borderColor: uiColors.sidebarBorder,
            }}
          >
            {commands.map((cmd) => {
              const inActiveSet = activeFilters.has(cmd.label);
              const selected = inActiveSet && !allFiltersActive;
              const color = labelColorMap.get(cmd.label) ?? uiColors.accent;
              const baseBg = selected ? uiColors.pageBg : 'transparent';
              return (
                <button
                  key={cmd.label}
                  type="button"
                  onClick={() => selectOnlyFilter(cmd.label)}
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors"
                  style={{
                    backgroundColor: baseBg,
                    color: selected ? uiColors.textPrimary : uiColors.textMuted,
                  }}
                  onMouseEnter={(e) => {
                    if (!selected) e.currentTarget.style.backgroundColor = uiColors.hoverBg;
                    e.currentTarget.style.color = uiColors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = baseBg;
                    e.currentTarget.style.color = selected
                      ? uiColors.textPrimary
                      : uiColors.textMuted;
                  }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color, opacity: inActiveSet ? 1 : 0.5 }}
                  />
                  {cmd.label}
                  {cmd.status === 'exited' && (
                    <span style={{ color: uiColors.success }}>{'✓'}</span>
                  )}
                  {cmd.status === 'errored' && (
                    <span style={{ color: uiColors.dangerText }}>{'✗'}</span>
                  )}
                </button>
              );
            })}
            {(() => {
              const allBaseBg = allFiltersActive ? uiColors.pageBg : 'transparent';
              return (
                <button
                  type="button"
                  onClick={setAllFilters}
                  className="rounded-full px-2.5 py-1 text-xs transition-colors"
                  style={{
                    backgroundColor: allBaseBg,
                    color: allFiltersActive ? uiColors.textPrimary : uiColors.textMuted,
                  }}
                  onMouseEnter={(e) => {
                    if (!allFiltersActive) e.currentTarget.style.backgroundColor = uiColors.hoverBg;
                    e.currentTarget.style.color = uiColors.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = allBaseBg;
                    e.currentTarget.style.color = allFiltersActive
                      ? uiColors.textPrimary
                      : uiColors.textMuted;
                  }}
                >
                  All
                </button>
              );
            })()}
          </div>
        )}

        {/* Start / Stop button \u2014 always visible */}
        <PlaybookToggleButton
          isRunning={isRunning}
          pending={pending}
          onStart={onStart}
          onStop={onStop}
          className="h-8 w-8 shrink-0"
        />
      </div>

      {/* Log stream */}
      <ScrollArea
        ref={logContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 p-4 font-mono text-sm"
      >
        {filteredLogs.map((log, i) => {
          const color = labelColorMap.get(log.source) ?? uiColors.accent;
          return (
            // oxlint-disable-next-line no-array-index-key
            <div key={i} className="leading-relaxed break-all whitespace-pre-wrap">
              <span style={{ color }} className="font-semibold select-none">
                [{log.source}]{' '}
              </span>
              <span
                className="text-white/80"
                dangerouslySetInnerHTML={{ __html: ansiConverter.toHtml(log.text) }}
              />
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="flex h-full items-center justify-center text-white/20">
            {isRunning ? 'Waiting for output...' : 'Press Start to run the playbook'}
          </div>
        )}
      </ScrollArea>

      {/* Jump to tail */}
      {showJumpToTail && (
        <button
          onClick={jumpToTail}
          className="absolute right-6 bottom-4 rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-1.5 text-xs text-white/50 shadow-lg transition-colors hover:text-white/80"
        >
          Jump to tail
        </button>
      )}
    </div>
  );
}
