import type { ITheme } from '@xterm/xterm';

export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  theme: ITheme;
}

// UI colors derived from the terminal theme for consistent styling
export const uiColors = {
  // Page and sidebar backgrounds — darker shades of the terminal background
  pageBg: '#2e3440',
  sidebarBg: '#2b303b',
  sidebarBorder: '#3b4252',
  // Text
  textPrimary: '#d8dee9',
  textMuted: '#7b88a1',
  textDim: '#4c566a',
  // Interactive states
  activeBg: '#3b4252',
  activeBorder: '#434c5e',
  hoverBg: '#353b48',
  // Accents — pulled from terminal ANSI colors
  accent: '#81a1c1',
  dangerBg: 'rgba(191, 97, 106, 0.2)',
  dangerText: '#bf616a',
  dangerHoverBg: 'rgba(191, 97, 106, 0.3)',
  // Notification dots
  notificationIdle: '#81a1c1',
  notificationPermission: '#bf616a',
};

export const terminalConfig: TerminalConfig = {
  fontSize: 14,
  fontFamily: "'MesloLGM Nerd Font', 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  cursorBlink: true,
  theme: {
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selectionBackground: '#434c5e',
    selectionForeground: '#d8dee9',
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
};
