import type { ReactNode } from 'react';

import { uiColors } from '../terminal-config';

export default function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`font-mono ${className ?? ''}`}
      style={{
        color: uiColors.textDim,
        background: 'rgba(0, 0, 0, 0.25)',
        border: `1px solid ${uiColors.sidebarBorder}`,
        borderBottom: `2px solid ${uiColors.sidebarBorder}`,
        borderRadius: '3px',
        padding: '1px 5px',
        fontSize: '10px',
        lineHeight: '1.3',
      }}
    >
      {children}
    </span>
  );
}
