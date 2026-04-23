import { Loader2, Play, Square } from 'lucide-react';

import { uiColors } from '../terminal-config';

export type PlaybookPending = 'starting' | 'stopping' | undefined;

interface Props {
  isRunning: boolean;
  pending?: PlaybookPending;
  onStart: () => void;
  onStop: () => void;
  className?: string;
  iconSize?: number;
}

export default function PlaybookToggleButton({
  isRunning,
  pending,
  onStart,
  onStop,
  className = '',
  iconSize = 12,
}: Props) {
  const isPending = pending !== undefined;
  // When pending, mirror the colors of the state we're transitioning *to*
  // so the button previews the outcome rather than what it currently is.
  const showRunningStyle = pending === 'stopping' || (isRunning && pending !== 'starting');
  const baseBg = showRunningStyle ? uiColors.dangerBg : uiColors.successBg;
  const hoverBg = showRunningStyle ? uiColors.dangerHoverBg : uiColors.successHoverBg;
  const borderColor = showRunningStyle ? uiColors.dangerBorder : uiColors.successBorder;
  const fgColor = showRunningStyle ? uiColors.dangerText : uiColors.success;

  let label: string;
  if (pending === 'starting') label = 'Starting playbook…';
  else if (pending === 'stopping') label = 'Stopping playbook…';
  else if (isRunning) label = 'Stop playbook';
  else label = 'Start playbook';

  return (
    <button
      type="button"
      onClick={isRunning ? onStop : onStart}
      title={label}
      aria-label={label}
      disabled={isPending}
      className={`flex items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: baseBg,
        borderColor,
        color: fgColor,
        opacity: isPending ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (isPending) return;
        e.currentTarget.style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        if (isPending) return;
        e.currentTarget.style.backgroundColor = baseBg;
      }}
    >
      {isPending ? (
        <Loader2 size={iconSize + 2} className="animate-spin" strokeWidth={2.5} />
      ) : isRunning ? (
        <Square size={iconSize} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play size={iconSize + 2} fill="currentColor" strokeWidth={0} />
      )}
    </button>
  );
}
