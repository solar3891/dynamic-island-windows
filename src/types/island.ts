export type IslandMode =
  | 'idle'
  | 'compact-media'
  | 'compact-timer'
  | 'split-media-timer'
  | 'expanded-media'
  | 'expanded-timer'
  | 'hud-volume'
  | 'hud-brightness'
  | 'hud-battery'
  | 'hud-capslock'
  | 'hud-bluetooth'
  | 'hud-stats'
  | 'hud-mute'
  | 'hud-welcome'
  | 'hud-clipboard'
  | 'hud-download'
  | 'drop-shelf';

export interface MediaTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number; // in seconds
  position: number; // in seconds
  isPlaying: boolean;
  source: 'Spotify' | 'Apple Music' | 'YouTube' | 'SoundCloud' | 'Windows SMTC' | 'Windows' | 'Edge' | string;
}

export interface VolumeState {
  level: number; // 0 - 100
  isMuted: boolean;
}

export interface BatteryState {
  level: number; // 0 - 100
  isCharging: boolean;
  timeRemaining?: string;
}

export interface BluetoothDevice {
  name: string;
  type: 'airpods' | 'headphones' | 'watch' | 'generic';
  batteryLeft?: number;
  batteryRight?: number;
  batteryCase?: number;
}

export interface TimerState {
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  label: string;
}

export interface IslandSettings {
  topOffset: number; // px from top of screen
  scale: number; // 0.8 - 1.2
  soundEnabled: boolean;
  autoExpandOnHover: boolean;
  collapseDelayMs: number;
}
