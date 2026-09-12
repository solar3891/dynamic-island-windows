import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface DownloadActiveEvent {
  filename: string;
  downloadedBytes: number;
  speedKbps: number;
  path?: string;
}

export interface DownloadCompleteEvent {
  filename: string;
  totalBytes?: number;
  path?: string;
}

export const isTauri = (): boolean => {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).__TAURI_INTERNALS__ ||
    (window as any).__TAURI__ ||
    window.location.protocol === 'tauri:' ||
    window.navigator.userAgent.includes('Tauri')
  );
};

export interface NativeBatteryInfo {
  level: number;
  is_charging: boolean;
  has_battery: boolean;
}

export interface LiveMediaTrack {
  title: string;
  artist: string;
  album: string;
  is_playing: boolean;
  source: string;
  position_secs: number;
  duration_secs: number;
  album_art?: string | null;
}

export interface NativeVolumeInfo {
  level: number;
  is_muted: boolean;
}

export interface NativeSystemStats {
  ram_percent: number;
  ram_used_gb: number;
  ram_total_gb: number;
  cpu_percent: number;
  mic_in_use: boolean;
  camera_in_use: boolean;
}

export interface NativeAudioDeviceInfo {
  name: string;
  is_muted: boolean;
  volume_level: number;
  is_bluetooth: boolean;
}

export const nativeApi = {
  getCurrentSystemMedia: async (): Promise<LiveMediaTrack | null> => {
    if (!isTauri()) return null;
    try {
      return await invoke<LiveMediaTrack | null>('get_current_system_media');
    } catch (e) {
      console.warn('getCurrentSystemMedia failed:', e);
      return null;
    }
  },

  getBatteryStatus: async (): Promise<NativeBatteryInfo | null> => {
    if (!isTauri()) return null;
    try {
      return await invoke<NativeBatteryInfo>('get_battery_status');
    } catch (e) {
      console.warn('Native battery query failed:', e);
      return null;
    }
  },

  playPauseMedia: async () => {
    if (!isTauri()) return;
    try {
      await invoke('send_media_play_pause');
    } catch (e) {
      console.warn('Native media play/pause failed:', e);
    }
  },

  nextMedia: async () => {
    if (!isTauri()) return;
    try {
      await invoke('send_media_next');
    } catch (e) {
      console.warn('Native media next failed:', e);
    }
  },

  prevMedia: async () => {
    if (!isTauri()) return;
    try {
      await invoke('send_media_prev');
    } catch (e) {
      console.warn('Native media prev failed:', e);
    }
  },

  seekMedia: async (secs: number): Promise<boolean> => {
    if (!isTauri()) return false;
    try {
      return await invoke<boolean>('seek_system_media', { positionSecs: Math.round(secs) });
    } catch (e) {
      console.warn('Native seekMedia failed:', e);
      return false;
    }
  },

  volumeUp: async () => {
    if (!isTauri()) return;
    try {
      await invoke('send_volume_up');
    } catch (e) {
      console.warn('Native volume up failed:', e);
    }
  },

  volumeDown: async () => {
    if (!isTauri()) return;
    try {
      await invoke('send_volume_down');
    } catch (e) {
      console.warn('Native volume down failed:', e);
    }
  },

  setClickThrough: async (ignore: boolean) => {
    if (!isTauri()) return;
    try {
      await invoke('set_click_through', { ignore });
    } catch (e) {
      console.warn('Native set_click_through failed:', e);
    }
  },

  getSystemVolume: async (): Promise<NativeVolumeInfo | null> => {
    if (!isTauri()) return null;
    try {
      return await invoke<NativeVolumeInfo>('get_system_volume');
    } catch (e) {
      console.warn('Native get_system_volume failed:', e);
      return null;
    }
  },

  setSystemVolume: async (levelPercent: number) => {
    if (!isTauri()) return;
    try {
      await invoke('set_system_volume', { levelPercent });
    } catch (e) {
      console.warn('Native set_system_volume failed:', e);
    }
  },

  logFromFrontend: async (msg: string) => {
    if (!isTauri()) return;
    try {
      await invoke('log_from_frontend', { msg });
    } catch {}
  },

  getSystemStats: async (): Promise<NativeSystemStats | null> => {
    if (!isTauri()) return null;
    try {
      return await invoke<NativeSystemStats>('get_system_stats');
    } catch (e) {
      console.warn('Native get_system_stats failed:', e);
      return null;
    }
  },

  centerAtTop: async (width: number, height: number) => {
    if (!isTauri()) return;
    try {
      await invoke('center_at_top', { width, height });
    } catch (e) {
      console.warn('Native center_at_top failed:', e);
    }
  },

  getActiveAudioDevice: async (): Promise<NativeAudioDeviceInfo | null> => {
    if (!isTauri()) return null;
    try {
      return await invoke<NativeAudioDeviceInfo>('get_active_audio_device');
    } catch (e) {
      console.warn('Native get_active_audio_device failed:', e);
      return null;
    }
  },

  getCapsLockState: async (): Promise<boolean> => {
    if (!isTauri()) return false;
    try {
      return await invoke<boolean>('get_caps_lock_state');
    } catch {
      return false;
    }
  },

  toggleMute: async (): Promise<boolean> => {
    if (!isTauri()) return false;
    try {
      return await invoke<boolean>('toggle_mute');
    } catch {
      return false;
    }
  },

  getClipboardText: async (): Promise<string | null> => {
    if (!isTauri()) return null;
    try {
      return await invoke<string | null>('get_clipboard_text');
    } catch {
      return null;
    }
  },

  copyToClipboard: async (text: string): Promise<boolean> => {
    if (!isTauri()) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    try {
      await invoke('copy_to_clipboard', { text });
      return true;
    } catch (e) {
      console.warn('Native copy_to_clipboard failed, trying browser fallback:', e);
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
  },

  exitApp: async () => {
    if (!isTauri()) return;
    try {
      await invoke('exit_app');
    } catch (e) {
      console.warn('Native exit_app failed:', e);
    }
  },

  launchTaskManager: async (): Promise<boolean> => {
    if (!isTauri()) {
      console.log('[Dev] launchTaskManager called (browser fallback)');
      return false;
    }
    try {
      await invoke('launch_task_manager');
      return true;
    } catch (e) {
      console.warn('Native launch_task_manager failed:', e);
      return false;
    }
  },

  openSoundSettings: async (): Promise<boolean> => {
    if (!isTauri()) {
      console.log('[Dev] openSoundSettings called (browser fallback)');
      return false;
    }
    try {
      await invoke('open_sound_settings');
      return true;
    } catch (e) {
      console.warn('Native open_sound_settings failed:', e);
      return false;
    }
  },

  showInFolder: async (path: string): Promise<boolean> => {
    if (!isTauri()) {
      console.log('[Dev] showInFolder called (browser fallback):', path);
      return false;
    }
    try {
      await invoke('show_in_folder', { path });
      return true;
    } catch (e) {
      console.warn('Native show_in_folder failed:', e);
      return false;
    }
  },

  openFilePath: async (path: string): Promise<boolean> => {
    return nativeApi.showInFolder(path);
  },

  focusMediaSource: async (source: string, title: string): Promise<boolean> => {
    if (!isTauri()) {
      console.log('[Dev] focusMediaSource called (browser fallback):', source, title);
      return false;
    }
    try {
      return await invoke<boolean>('focus_media_source', { source, title });
    } catch (e) {
      console.warn('Native focus_media_source failed:', e);
      return false;
    }
  },
};

export const launchTaskManager = nativeApi.launchTaskManager;
export const openSoundSettings = nativeApi.openSoundSettings;
export const openFilePath = nativeApi.openFilePath;
export const showInFolder = nativeApi.showInFolder;
export const copyToClipboard = nativeApi.copyToClipboard;
export const focusMediaSource = nativeApi.focusMediaSource;

export const listenHardwareVolume = async (
  callback: (data: { level: number; isMuted: boolean }) => void
): Promise<UnlistenFn | null> => {
  if (!isTauri()) return null;
  try {
    return await listen<{ level: number; isMuted: boolean }>('hw-volume', (event) => {
      callback(event.payload);
    });
  } catch (e) {
    console.warn('listenHardwareVolume failed:', e);
    return null;
  }
};

export const listenHardwareCapsLock = async (
  callback: (data: { isActive: boolean }) => void
): Promise<UnlistenFn | null> => {
  if (!isTauri()) return null;
  try {
    return await listen<{ isActive: boolean }>('hw-capslock', (event) => {
      callback(event.payload);
    });
  } catch (e) {
    console.warn('listenHardwareCapsLock failed:', e);
    return null;
  }
};

export const listenHardwareMute = async (
  callback: (data: { isMuted: boolean }) => void
): Promise<UnlistenFn | null> => {
  if (!isTauri()) return null;
  try {
    return await listen<{ isMuted: boolean }>('hw-mute', (event) => {
      callback(event.payload);
    });
  } catch (e) {
    console.warn('listenHardwareMute failed:', e);
    return null;
  }
};

export const listenDownloadActive = async (
  callback: (data: DownloadActiveEvent) => void
): Promise<UnlistenFn | null> => {
  if (!isTauri()) return null;
  try {
    return await listen<DownloadActiveEvent>('download-active', (event) => {
      callback(event.payload);
    });
  } catch (e) {
    console.warn('listenDownloadActive failed:', e);
    return null;
  }
};

export const listenDownloadComplete = async (
  callback: (data: DownloadCompleteEvent) => void
): Promise<UnlistenFn | null> => {
  if (!isTauri()) return null;
  try {
    return await listen<DownloadCompleteEvent>('download-complete', (event) => {
      callback(event.payload);
    });
  } catch (e) {
    console.warn('listenDownloadComplete failed:', e);
    return null;
  }
};

