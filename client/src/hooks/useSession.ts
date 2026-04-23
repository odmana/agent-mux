import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';

import { terminalConfig } from '../terminal-config';
import type {
  DisconnectReason,
  NotificationState,
  PlaybookCommandStatus,
  PlaybookLogEntry,
} from '../types';
import { WAKE_EVENT } from './useWakeDetector';

export interface UseSessionResult {
  disconnectReason: DisconnectReason | null;
  reconnect: () => void;
  sendMessage: (msg: object) => void;
}

export function useSession(
  sessionId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
  onNotification?: (sessionId: string, state: NotificationState) => void,
  onBranchUpdate?: (sessionId: string, branch: string) => void,
  onPlaybookOutput?: (entry: PlaybookLogEntry) => void,
  onPlaybookStatus?: (commands: PlaybookCommandStatus[], startedAt: number | null) => void,
  onPlaybookStopped?: () => void,
): UseSessionResult {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsCleanupRef = useRef<(() => void) | null>(null);
  const onNotificationRef = useRef(onNotification);
  onNotificationRef.current = onNotification;
  const onBranchUpdateRef = useRef(onBranchUpdate);
  onBranchUpdateRef.current = onBranchUpdate;
  const onPlaybookOutputRef = useRef(onPlaybookOutput);
  onPlaybookOutputRef.current = onPlaybookOutput;
  const onPlaybookStatusRef = useRef(onPlaybookStatus);
  onPlaybookStatusRef.current = onPlaybookStatus;
  const onPlaybookStoppedRef = useRef(onPlaybookStopped);
  onPlaybookStoppedRef.current = onPlaybookStopped;

  const [disconnectReason, setDisconnectReason] = useState<DisconnectReason | null>(null);

  // Stable function to create a WebSocket connection.
  // Reads terminalRef/fitAddonRef/wsRef at call time — safe to call after terminal is created.
  const connectWebSocket = useCallback(
    (sid: string) => {
      const terminal = terminalRef.current;
      if (!terminal) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${sid}`);
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
            if (msg.type === 'notification') {
              onNotificationRef.current?.(msg.sessionId, msg.state);
              return;
            }
            if (msg.type === 'branch_update') {
              onBranchUpdateRef.current?.(msg.sessionId, msg.branch);
              return;
            }
            if (msg.type === 'playbook:output') {
              onPlaybookOutputRef.current?.({ source: msg.source, text: msg.text });
              return;
            }
            if (msg.type === 'playbook:status') {
              const startedAt = typeof msg.startedAt === 'number' ? msg.startedAt : null;
              onPlaybookStatusRef.current?.(msg.commands, startedAt);
              return;
            }
            if (msg.type === 'playbook:stopped') {
              onPlaybookStoppedRef.current?.();
              return;
            }
          } catch {
            // Not valid JSON — treat as terminal data
          }
        }
        terminal.write(data);
      };

      // oxlint-disable-next-line prefer-add-event-listener
      ws.onerror = () => {};

      // oxlint-disable-next-line prefer-add-event-listener
      ws.onclose = (event) => {
        setDisconnectReason(event.code === 4000 ? 'pty_exited' : 'network');
      };

      const cleanup = () => {
        // oxlint-disable-next-line prefer-add-event-listener
        ws.onopen = null;
        // oxlint-disable-next-line prefer-add-event-listener
        ws.onmessage = null;
        // oxlint-disable-next-line prefer-add-event-listener
        ws.onerror = null;
        // oxlint-disable-next-line prefer-add-event-listener
        ws.onclose = null;
        ws.close();
        wsRef.current = null;
      };
      wsCleanupRef.current = cleanup;

      return cleanup;
    },
    [], // stable — reads everything from refs
  );

  // Create terminal, connect WebSocket, and set up resize observer.
  // sessionId is stable for the lifetime of this component (React re-keys on ID change).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal(terminalConfig);

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

    // Forward terminal input to current WebSocket
    terminal.onData((data) => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Resize observer
    const observer = new ResizeObserver(() => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        const { cols, rows } = terminal;
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });
    observer.observe(container);

    // Connect WebSocket now that the terminal is ready
    connectWebSocket(sessionId);

    return () => {
      observer.disconnect();
      wsCleanupRef.current?.();
      terminalRef.current = null;
      fitAddonRef.current = null;
      terminal.dispose();
    };
  }, [sessionId, containerRef, connectWebSocket]);

  // Focus and fit when becoming active
  useEffect(() => {
    if (isActive && terminalRef.current && fitAddonRef.current) {
      terminalRef.current.focus();
      fitAddonRef.current.fit();
    }
  }, [isActive]);

  const reconnect = useCallback(() => {
    wsCleanupRef.current?.();
    terminalRef.current?.clear();
    setDisconnectReason(null);
    connectWebSocket(sessionId);
  }, [sessionId, connectWebSocket]);

  // Auto-reconnect after the machine wakes from sleep or the network comes back.
  // Skip if the socket still looks healthy so we don't clear/replay healthy terminals.
  useEffect(() => {
    const handler = () => {
      const ws = wsRef.current;
      if (!ws || (ws.readyState !== WebSocket.OPEN && ws.readyState !== WebSocket.CONNECTING)) {
        reconnect();
      }
    };
    window.addEventListener(WAKE_EVENT, handler);
    return () => window.removeEventListener(WAKE_EVENT, handler);
  }, [reconnect]);

  const sendMessage = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  return { disconnectReason, reconnect, sendMessage };
}
