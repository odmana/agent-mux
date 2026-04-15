export type NotificationState = 'none' | 'idle' | 'permission' | 'working';

export type DisconnectReason = 'network' | 'pty_exited';

export interface Session {
  id: string;
  directory: string;
  branch: string;
  auxId?: string;
}
