import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useEffect, useRef } from 'react';

import { terminalConfig } from '../terminal-config';
import type { NotificationState } from '../types';

export function useSession(
  sessionId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
  onNotification?: (sessionId: string, state: NotificationState) => void,
  onBranchUpdate?: (sessionId: string, branch: string) => void,
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const onBranchUpdateRef = useRef(onBranchUpdate);
  onBranchUpdateRef.current = onBranchUpdate;

  // Create terminal and WebSocket on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal(terminalConfig);

    // Let the browser handle Ctrl+C (copy when text is selected) and
    // Ctrl+V / Ctrl+Shift+V (paste) instead of xterm consuming them.
    // On Mac, Cmd+C/V is handled natively and doesn't set ctrlKey.
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && !event.metaKey && event.key === 'c' && terminal.hasSelection()) {
        return false;
      }
      if (event.ctrlKey && !event.metaKey && (event.key === 'v' || event.key === 'V')) {
        return false;
      }
      return true;
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sessionId}`);
    wsRef.current = ws;

    // oxlint-disable-next-line prefer-add-event-listener -- .on* is idiomatic for WebSocket; cleanup nulls out handlers to prevent writes to disposed terminal
    ws.onopen = () => {
      const { cols, rows } = terminal;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    // oxlint-disable-next-line prefer-add-event-listener
    ws.onmessage = (event) => {
      const data = event.data;
      if (typeof data === 'string' && data.startsWith('{')) {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'notification' && onNotificationRef.current) {
            onNotificationRef.current(msg.sessionId, msg.state);
            return;
          }
          if (msg.type === 'branch_update' && onBranchUpdateRef.current) {
            onBranchUpdateRef.current(msg.sessionId, msg.branch);
            return;
          }
        } catch {
          // Not valid JSON — treat as terminal data
        }
      }
      terminal.write(data);
    };

    // oxlint-disable-next-line prefer-add-event-listener
    ws.onerror = () => {
      terminal.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
    };

    // oxlint-disable-next-line prefer-add-event-listener
    ws.onclose = () => {
      terminal.write('\r\n\x1b[33mDisconnected\x1b[0m\r\n');
    };

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      if (ws.readyState === WebSocket.OPEN) {
        const { cols, rows } = terminal;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      // Null out handlers before closing to prevent writes to a disposed terminal
      // oxlint-disable-next-line prefer-add-event-listener
      ws.onopen = null;
      // oxlint-disable-next-line prefer-add-event-listener
      ws.onmessage = null;
      // oxlint-disable-next-line prefer-add-event-listener
      ws.onerror = null;
      // oxlint-disable-next-line prefer-add-event-listener
      ws.onclose = null;
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, [sessionId, containerRef]);

  // Focus and fit when becoming active
  useEffect(() => {
    if (isActive && terminalRef.current && fitAddonRef.current) {
      terminalRef.current.focus();
      fitAddonRef.current.fit();
    }
  }, [isActive]);
}
