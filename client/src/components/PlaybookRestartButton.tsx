import { RotateCcw } from 'lucide-react';

import { uiColors } from '../terminal-config';
import type { PlaybookPending } from './PlaybookToggleButton';

interface Props {
  pending?: PlaybookPending;
  onRestart: () => void;
  className?: string;
  iconSize?: number;
}

export default function PlaybookRestartButton({
  pending,
  onRestart,
  className = '',
  iconSize = 12,
}: Props) {
  const isPending = pending !== undefined;

  return (
    <button
      type="button"
      onClick={onRestart}
      title="Restart playbook"
      aria-label="Restart playbook"
      disabled={isPending}
      className={`flex items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: uiColors.accentBg,
        borderColor: uiColors.accentBorder,
        color: uiColors.accent,
        opacity: isPending ? 0.7 : 1,
      }}
      onMouseEnter={(e) => {
        if (isPending) return;
        e.currentTarget.style.backgroundColor = uiColors.accentHoverBg;
      }}
      onMouseLeave={(e) => {
        if (isPending) return;
        e.currentTarget.style.backgroundColor = uiColors.accentBg;
      }}
    >
      <RotateCcw size={iconSize} strokeWidth={2.5} />
    </button>
  );
}
