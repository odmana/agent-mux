export type NotificationState = 'none' | 'idle' | 'permission';

export interface Session {
  id: string;
  directory: string;
  branch: string;
}
