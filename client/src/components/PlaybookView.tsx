import AnsiToHtml from 'ansi-to-html';
import { Play, Square } from 'lucide-react';
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';

import { uiColors } from '../terminal-config';
import type { PlaybookCommandStatus, PlaybookLogEntry } from '../types';

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
  onStart: () => void;
  onStop: () => void;
  onChangePlaybook: () => void;
}

export default function PlaybookView({
  playbookName,
  commands,
  logs,
  isRunning,
  onStart,
  onStop,
  onChangePlaybook,
}: PlaybookViewProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(commands.map((c) => c.label)),
  );
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
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

  const toggleFilter = (label: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const labelColorMap = new Map<string, string>();
  commands.forEach((cmd, i) => {
    labelColorMap.set(cmd.label, LABEL_COLORS[i % LABEL_COLORS.length]);
  });

  const filteredLogs = logs.filter((log) => activeFilters.has(log.source));

  return (
    <div className="relative flex h-full flex-col" style={{ backgroundColor: uiColors.pageBg }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 border-b px-4 py-2.5"
        style={{ borderColor: uiColors.sidebarBorder }}
      >
        <button
          onClick={onChangePlaybook}
          className="min-w-0 flex-1 truncate rounded-lg border px-3 py-1.5 text-left text-sm transition-colors hover:border-white/20"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            color: uiColors.textPrimary,
          }}
        >
          {playbookName}
        </button>
        <button
          onClick={isRunning ? onStop : onStart}
          className="shrink-0 rounded-lg p-1.5 transition-colors"
          style={{
            backgroundColor: isRunning ? uiColors.dangerBg : 'rgba(163, 190, 140, 0.2)',
            color: isRunning ? uiColors.dangerText : '#a3be8c',
          }}
        >
          {isRunning ? <Square size={16} /> : <Play size={16} />}
        </button>
      </div>

      {/* Filter toggles */}
      <div
        className="flex gap-2 border-b px-4 py-2"
        style={{ borderColor: uiColors.sidebarBorder }}
      >
        {commands.map((cmd) => {
          const active = activeFilters.has(cmd.label);
          const color = labelColorMap.get(cmd.label) ?? uiColors.accent;
          return (
            <button
              key={cmd.label}
              onClick={() => toggleFilter(cmd.label)}
              className="rounded-md border px-2 py-0.5 text-xs transition-colors"
              style={{
                borderColor: active ? color : 'rgba(255,255,255,0.1)',
                color: active ? color : uiColors.textDim,
                backgroundColor: active ? `${color}15` : 'transparent',
              }}
            >
              {cmd.label}
              {cmd.status !== 'running' && (
                <span className="ml-1 opacity-50">
                  {cmd.status === 'exited' ? '\u2713' : '\u2717'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Log stream */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-y-auto p-4 font-mono text-sm"
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
      </div>

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
