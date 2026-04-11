import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export function useSession(
  sessionId: string,
  containerRef: React.RefObject<HTMLDivElement | null>,
  isActive: boolean,
) {
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Create terminal and WebSocket on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      theme: {
        background: '#0c0c0c',
        foreground: '#e4e4e7',
        cursor: '#60a5fa',
      },
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

    ws.onopen = () => {
      const { cols, rows } = terminal;
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    };

    ws.onmessage = (event) => {
      terminal.write(event.data);
    };

    ws.onerror = () => {
      terminal.write('\r\n\x1b[31mConnection error\x1b[0m\r\n');
    };

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
      ws.close();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      wsRef.current = null;
    };
  }, [sessionId]);

  // Focus and fit when becoming active
  useEffect(() => {
    if (isActive && terminalRef.current && fitAddonRef.current) {
      terminalRef.current.focus();
      fitAddonRef.current.fit();
    }
  }, [isActive]);
}
