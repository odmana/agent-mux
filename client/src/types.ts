export type NotificationState = 'none' | 'idle' | 'permission' | 'working';

export type DisconnectReason = 'network' | 'pty_exited';

export interface PlaybookCommand {
  label: string;
  command: string;
}

export interface PlaybookConfig {
  name: string;
  commands: PlaybookCommand[];
}

export interface PlaybookCommandStatus {
  label: string;
  status: 'running' | 'exited' | 'errored';
  exitCode?: number;
}

export interface PlaybookLogEntry {
  source: string;
  text: string;
}

export interface Session {
  id: string;
  directory: string;
  branch: string;
  auxId?: string;
  playbook?: string;
}
