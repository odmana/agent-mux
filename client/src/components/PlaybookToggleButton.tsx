import { Play, Square } from 'lucide-react';

import { uiColors } from '../terminal-config';

interface Props {
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  className?: string;
  iconSize?: number;
}

export default function PlaybookToggleButton({
  isRunning,
  onStart,
  onStop,
  className = '',
  iconSize = 12,
}: Props) {
  const baseBg = isRunning ? uiColors.dangerBg : uiColors.successBg;
  const hoverBg = isRunning ? uiColors.dangerHoverBg : uiColors.successHoverBg;
  const borderColor = isRunning ? uiColors.dangerBorder : uiColors.successBorder;
  const fgColor = isRunning ? uiColors.dangerText : uiColors.success;
  const label = isRunning ? 'Stop playbook' : 'Start playbook';

  return (
    <button
      type="button"
      onClick={isRunning ? onStop : onStart}
      title={label}
      aria-label={label}
      className={`flex items-center justify-center rounded-md border transition-colors ${className}`}
      style={{
        backgroundColor: baseBg,
        borderColor,
        color: fgColor,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = baseBg;
      }}
    >
      {isRunning ? (
        <Square size={iconSize} fill="currentColor" strokeWidth={0} />
      ) : (
        <Play size={iconSize + 2} fill="currentColor" strokeWidth={0} />
      )}
    </button>
  );
}
