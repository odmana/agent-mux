export type NotificationState = 'none' | 'idle' | 'permission' | 'working';

export interface Session {
  id: string;
  directory: string;
  branch: string;
}
