import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  IslandMode,
  IslandSettings,
  MediaTrack,
  VolumeState,
  BatteryState,
  BluetoothDevice,
  TimerState,
} from './types/island';
import { IslandContainer } from './components/DynamicIsland/IslandContainer';
import type { DroppedItem } from './components/DynamicIsland/views/DropShelfView';
import type { DownloadHudProps } from './components/DynamicIsland/views/DownloadHudView';
import { sounds } from './utils/audio';
import {
  nativeApi,
  isTauri,
  type NativeSystemStats,
  listenHardwareVolume,
  listenHardwareCapsLock,
  listenHardwareMute,
  listenDownloadActive,
  listenDownloadComplete,
} from './utils/native';
import {
  Music,
  Volume2,
  BatteryCharging,
  Headphones,
  Timer,
  Sliders,
  Wifi,
  Search,
} from 'lucide-react';

const TRACKS: MediaTrack[] = [
  {
    id: '1',
    title: 'Chúng Ta Của Tương Lai',
    artist: 'Sơn Tùng M-TP',
    album: 'Single',
    albumArt: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&h=300&fit=crop',
    duration: 254,
    position: 74,
    isPlaying: true,
    source: 'Apple Music',
  },
  {
    id: '2',
    title: 'Ditto',
    artist: 'NewJeans',
    album: 'OMG - Single',
    albumArt: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&h=300&fit=crop',
    duration: 185,
    position: 32,
    isPlaying: true,
    source: 'Apple Music',
  },
];

function App() {
  const [mode, setMode] = useState<IslandMode>(() => (isTauri() ? 'hud-welcome' : 'compact-media'));
  const [trackIndex, setTrackIndex] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [systemStats, setSystemStats] = useState<NativeSystemStats | null>(null);
  const lastSeekTimeRef = useRef<number>(0);

  const handleOpenSoundSettings = useCallback(async () => {
    await nativeApi.openSoundSettings();
  }, []);

  const [settings, setSettings] = useState<IslandSettings>({
    topOffset: 8,
    scale: 1,
    soundEnabled: true,
    autoExpandOnHover: true,
    collapseDelayMs: 600,
  });

  const [mediaTrack, setMediaTrack] = useState<MediaTrack>(() => {
    if (isTauri()) {
      return {
        id: 'native-media',
        title: '',
        artist: '',
        album: '',
        albumArt: '',
        duration: 210,
        position: 0,
        isPlaying: false,
        source: 'Windows',
      };
    }
    return TRACKS[0];
  });
  const [volume, setVolume] = useState<VolumeState>({ level: 0, isMuted: false });
  const [brightness, setBrightness] = useState<number>(85);
  const [battery, setBattery] = useState<BatteryState>({ level: 100, isCharging: true });
  const [bluetoothDevice, setBluetoothDevice] = useState<BluetoothDevice>({
    name: 'Speakers',
    type: 'generic',
  });
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [timer, setTimer] = useState<TimerState>({
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    isRunning: false,
    label: 'Focus Session',
  });

  const [clipboardText, setClipboardText] = useState<string | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<DownloadHudProps | null>(null);
  const [shelfItems, setShelfItems] = useState<DroppedItem[]>([]);

  const mediaTrackRef = useRef(mediaTrack);
  useEffect(() => {
    mediaTrackRef.current = mediaTrack;
  }, [mediaTrack]);

  const timerRef = useRef(timer);
  useEffect(() => {
    timerRef.current = timer;
  }, [timer]);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const isUserInteractingRef = useRef(false);
  const handleInteractionChange = useCallback((active: boolean) => {
    isUserInteractingRef.current = active;
  }, []);

  const previousNonTransientModeRef = useRef<IslandMode>('idle');
  useEffect(() => {
    const isTransient =
      mode === 'hud-volume' ||
      mode === 'hud-mute' ||
      mode === 'hud-capslock' ||
      mode === 'hud-clipboard' ||
      mode === 'hud-download' ||
      mode === 'hud-battery' ||
      mode === 'hud-bluetooth';
    if (!isTransient) {
      previousNonTransientModeRef.current = mode;
    }
  }, [mode]);

  const getRevertMode = useCallback((): IslandMode => {
    // Preserve hud-stats if user is actively interacting or was previously in hud-stats
    if (
      isUserInteractingRef.current ||
      modeRef.current === 'hud-stats' ||
      previousNonTransientModeRef.current === 'hud-stats'
    ) {
      return 'hud-stats';
    }
    if (mediaTrackRef.current.isPlaying && timerRef.current.isRunning) {
      return 'split-media-timer';
    }
    if (mediaTrackRef.current.isPlaying) {
      return 'compact-media';
    }
    if (timerRef.current.isRunning) {
      return 'compact-timer';
    }
    return 'idle';
  }, []);

  const handleFocusMediaApp = useCallback(async () => {
    sounds.playClick(settings.soundEnabled);
    await nativeApi.focusMediaSource(mediaTrack.source, mediaTrack.title);
  }, [mediaTrack.source, mediaTrack.title, settings.soundEnabled]);

  // Dual Activities Synchronization (Split Island)
  useEffect(() => {
    if (mediaTrack.isPlaying && timer.isRunning) {
      queueMicrotask(() => {
        setMode((prev) => {
          if (prev === 'compact-media' || prev === 'compact-timer' || prev === 'idle') {
            return 'split-media-timer';
          }
          return prev;
        });
      });
    } else if (mode === 'split-media-timer') {
      queueMicrotask(() => {
        if (mediaTrack.isPlaying) {
          setMode('compact-media');
        } else if (timer.isRunning) {
          setMode('compact-timer');
        } else {
          setMode('idle');
        }
      });
    }
  }, [mediaTrack.isPlaying, timer.isRunning, mode]);

  const handleRemoveShelfItem = useCallback((id: string) => {
    sounds.playClick(settings.soundEnabled);
    setShelfItems((prev) => prev.filter((item) => item.id !== id));
  }, [settings.soundEnabled]);

  const handleOpenShelfFile = useCallback(async (path: string) => {
    sounds.playClick(settings.soundEnabled);
    await nativeApi.openFilePath(path);
  }, [settings.soundEnabled]);

  const handleDropShelfFiles = useCallback((files: File[]) => {
    if (!files || files.length === 0) return;
    sounds.playClick(settings.soundEnabled);
    const newItems: DroppedItem[] = files.map((f, idx) => {
      const filePath = (f as any).path || (f as any).webkitRelativePath || f.name;
      const sizeBytes = f.size || 0;
      const sizeFormatted = sizeBytes >= 1024 * 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
        : sizeBytes >= 1024 * 1024
        ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
        : sizeBytes >= 1024
        ? `${(sizeBytes / 1024).toFixed(1)} KB`
        : `${sizeBytes} B`;
      return {
        id: `shelf-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        name: f.name,
        path: filePath,
        size: sizeFormatted,
      };
    });
    setShelfItems((prev) => [...newItems, ...prev]);
    setMode('drop-shelf');
  }, [settings.soundEnabled]);

  // Tauri host drag & drop listener
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;

    const setupDragDrop = async () => {
      try {
        const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setMode('drop-shelf');
          } else if (event.payload.type === 'drop') {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              sounds.playClick(settings.soundEnabled);
              const newItems: DroppedItem[] = paths.map((p, idx) => {
                const name = p.split(/[/\\]/).filter(Boolean).pop() || p;
                return {
                  id: `tauri-drop-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                  name,
                  path: p,
                  size: 'Tệp đã thả',
                };
              });
              setShelfItems((prev) => [...newItems, ...prev]);
              setMode('drop-shelf');
            }
          }
        });
      } catch (err) {
        console.warn('Failed to register onDragDropEvent listener:', err);
      }
    };

    setupDragDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, [settings.soundEnabled]);

  // Live Timer Countdown Ticker
  useEffect(() => {
    if (!timer.isRunning) return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev.remainingSeconds <= 1) {
          sounds.playChime(settingsRef.current.soundEnabled);
          queueMicrotask(() => {
            setMode((currentMode) => {
              if (
                currentMode === 'compact-timer' ||
                currentMode === 'expanded-timer' ||
                currentMode === 'split-media-timer'
              ) {
                return mediaTrackRef.current.isPlaying ? 'compact-media' : 'idle';
              }
              return currentMode;
            });
          });
          return { ...prev, remainingSeconds: prev.totalSeconds, isRunning: false };
        }
        return { ...prev, remainingSeconds: prev.remainingSeconds - 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timer.isRunning]);

  // Realtime smooth playback timeline ticker
  useEffect(() => {
    if (!mediaTrack.isPlaying) return;
    const interval = setInterval(() => {
      setMediaTrack((prev) => {
        if (prev.duration > 0 && prev.position < prev.duration) {
          return { ...prev, position: prev.position + 1 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mediaTrack.isPlaying, mediaTrack.duration]);

  // Startup Welcome chime & HUD transition to idle
  useEffect(() => {
    sounds.playChime(settingsRef.current.soundEnabled);
    const welcomeTimer = setTimeout(() => {
      setMode((prev) => (prev === 'hud-welcome' ? 'idle' : prev));
    }, 2800);
    return () => clearTimeout(welcomeTimer);
  }, []);

  const [contextMenu, setContextMenu] = useState(false);

  // Dismiss context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleWindowClick = () => {
      setContextMenu(false);
    };
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('click', handleWindowClick);
    };
  }, [contextMenu]);

  // Real Windows Audio Output Device Detection & reactive HUD on switch/plug
  useEffect(() => {
    if (!isTauri()) return;
    let lastDevName = '';
    let initial = true;
    let devTimer: ReturnType<typeof setTimeout> | null = null;

    const pollDevice = async () => {
      const dev = await nativeApi.getActiveAudioDevice();
      if (dev && dev.name) {
        if (!initial && dev.name !== lastDevName) {
          sounds.playChime(settingsRef.current.soundEnabled);
          setBluetoothDevice({
            name: dev.name,
            type: dev.is_bluetooth ? 'airpods' : 'headphones',
          });
          setMode('hud-bluetooth');
          if (devTimer) clearTimeout(devTimer);
          devTimer = setTimeout(() => {
            setMode((prev) => {
              if (prev !== 'hud-bluetooth') return prev;
              if (mediaTrackRef.current.isPlaying && timerRef.current.isRunning) return 'split-media-timer';
              if (mediaTrackRef.current.isPlaying) return 'compact-media';
              if (timerRef.current.isRunning) return 'compact-timer';
              return getRevertMode();
            });
          }, 2800);
        } else if (initial) {
          setBluetoothDevice({
            name: dev.name,
            type: dev.is_bluetooth ? 'airpods' : 'headphones',
          });
        }
        initial = false;
        lastDevName = dev.name;
      }
    };

    pollDevice();
    const interval = setInterval(pollDevice, 1000);
    return () => {
      clearInterval(interval);
      if (devTimer) clearTimeout(devTimer);
    };
  }, [getRevertMode]);

  // Global Hardware Key Hooks Listeners (Volume, Mute, Caps Lock)
  useEffect(() => {
    if (!isTauri()) return;

    // Fetch initial state once
    nativeApi.getSystemVolume().then((vol) => {
      if (vol) setVolume({ level: vol.level, isMuted: vol.is_muted });
    });
    nativeApi.getCapsLockState().then((state) => {
      setIsCapsLockOn(state);
    });

    let unlistenVol: (() => void) | null = null;
    let unlistenMute: (() => void) | null = null;
    let unlistenCaps: (() => void) | null = null;
    let hudTimer: ReturnType<typeof setTimeout> | null = null;

    const setupHwListeners = async () => {
      const uVol = await listenHardwareVolume((payload) => {
        setVolume({ level: payload.level, isMuted: payload.isMuted });
        setMode('hud-volume');
        if (hudTimer) clearTimeout(hudTimer);
        hudTimer = setTimeout(() => {
          setMode((prev) => (prev === 'hud-volume' ? getRevertMode() : prev));
        }, 1600);
      });
      unlistenVol = uVol;

      const uMute = await listenHardwareMute((payload) => {
        setVolume((prev) => ({ ...prev, isMuted: payload.isMuted }));
        setMode('hud-mute');
        if (hudTimer) clearTimeout(hudTimer);
        hudTimer = setTimeout(() => {
          setMode((prev) => (prev === 'hud-mute' ? getRevertMode() : prev));
        }, 1600);
      });
      unlistenMute = uMute;

      const uCaps = await listenHardwareCapsLock((payload) => {
        setIsCapsLockOn(payload.isActive);
        setMode('hud-capslock');
        if (hudTimer) clearTimeout(hudTimer);
        hudTimer = setTimeout(() => {
          setMode((prev) => (prev === 'hud-capslock' ? getRevertMode() : prev));
        }, 1300);
      });
      unlistenCaps = uCaps;
    };

    setupHwListeners();

    return () => {
      if (unlistenVol) unlistenVol();
      if (unlistenMute) unlistenMute();
      if (unlistenCaps) unlistenCaps();
      if (hudTimer) clearTimeout(hudTimer);
    };
  }, [getRevertMode]);

  // Realtime Downloads Watcher Listeners
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenActive: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;
    let completeTimer: ReturnType<typeof setTimeout> | null = null;

    const setupDownloads = async () => {
      const uActive = await listenDownloadActive((data) => {
        setDownloadInfo({
          filename: data.filename,
          speedKbps: data.speedKbps,
          downloadedBytes: data.downloadedBytes,
          isComplete: false,
          filePath: data.path,
          onClick: () => {
            nativeApi.showInFolder(data.path || '');
          },
        });
        setMode((prev) =>
          prev !== 'split-media-timer' && prev !== 'expanded-media' && prev !== 'expanded-timer'
            ? 'hud-download'
            : prev
        );
      });
      unlistenActive = uActive;

      const uComplete = await listenDownloadComplete((data) => {
        sounds.playChime(settingsRef.current.soundEnabled);
        setDownloadInfo({
          filename: data.filename,
          speedKbps: 0,
          downloadedBytes: data.totalBytes,
          isComplete: true,
          filePath: data.path,
          onClick: () => {
            nativeApi.showInFolder(data.path || '');
          },
        });
        setMode('hud-download');
        if (completeTimer) clearTimeout(completeTimer);
        completeTimer = setTimeout(() => {
          setDownloadInfo(null);
          setMode((prev) => (prev === 'hud-download' ? getRevertMode() : prev));
        }, 3500);
      });
      unlistenComplete = uComplete;
    };

    setupDownloads();

    return () => {
      if (unlistenActive) unlistenActive();
      if (unlistenComplete) unlistenComplete();
      if (completeTimer) clearTimeout(completeTimer);
    };
  }, [getRevertMode]);

  // Real Windows system RAM / CPU / Privacy stats polling
  useEffect(() => {
    const fetchStats = async () => {
      const s = await nativeApi.getSystemStats();
      if (s) setSystemStats(s);
    };
    fetchStats();
    const interval = setInterval(fetchStats, 1200);
    return () => clearInterval(interval);
  }, []);

  // Real Windows Clipboard polling & reactive HUD on Ctrl+C (Safe non-cancelling timer)
  const lastClipRef = useRef<string>('');
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let initial = true;

    const pollClipboard = async () => {
      const text = await nativeApi.getClipboardText();
      if (text && text.trim().length > 0) {
        if (!initial && text !== lastClipRef.current) {
          setClipboardText(text);
          setMode('hud-clipboard');
          if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
          clipTimerRef.current = setTimeout(() => {
            setMode((prev) => (prev === 'hud-clipboard' ? getRevertMode() : prev));
            clipTimerRef.current = null;
          }, 1800);
        } else if (initial) {
          setClipboardText(text);
        }
        initial = false;
        lastClipRef.current = text;
      }
    };

    pollClipboard();
    const interval = setInterval(pollClipboard, 600);
    return () => {
      clearInterval(interval);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, [getRevertMode]);

  // Real Windows SMTC Live Media Polling with Anti-Jitter Hysteresis
  const missedPollsRef = useRef(0);

  useEffect(() => {
    let pauseRetractTimer: ReturnType<typeof setTimeout> | null = null;

    const pollMedia = async () => {
      const live = await nativeApi.getCurrentSystemMedia();
      if (live && live.title && live.title.trim().length > 0) {
        missedPollsRef.current = 0;
        setMediaTrack((prev) => {
          const isSameTrack = prev.title === live.title && prev.artist === (live.artist || 'Windows Media');
          const isSeekSuppressed = Date.now() - lastSeekTimeRef.current < 1500;

          let newPos = prev.position;
          if (isSeekSuppressed) {
            newPos = prev.position;
          } else if (!isSameTrack) {
            // New track started: accept live position directly
            newPos = live.position_secs || 0;
          } else {
            // Same track continues:
            const livePos = live.position_secs || 0;
            if (livePos === 0 && prev.position > 2 && live.is_playing) {
              // False 0 from SMTC dropout / fallback: ignore 0 and preserve smoothly ticking local position!
              newPos = prev.position;
            } else if (livePos < prev.position && prev.position - livePos <= 4 && live.is_playing) {
              // SMTC latency jitter (Chromium background throttle): do NOT jump backwards
              newPos = prev.position;
            } else if (Math.abs(livePos - prev.position) > 2 || !prev.isPlaying) {
              // Real seek or significant delta
              newPos = livePos;
            } else {
              newPos = prev.position;
            }
          }

          const resolvedArt = live.album_art || (isSameTrack ? prev.albumArt : '') || '';

          const srcLower = (live.source || '').toLowerCase();
          const resolvedSource = srcLower.includes('spotify')
            ? 'Spotify'
            : srcLower.includes('chrome') || srcLower.includes('brave') || srcLower.includes('coccoc') || srcLower.includes('youtube')
            ? 'YouTube'
            : srcLower.includes('msedge') || srcLower.includes('edge')
            ? 'Edge'
            : srcLower.includes('apple')
            ? 'Apple Music'
            : 'Windows Media';

          return {
            ...prev,
            title: live.title,
            artist: live.artist || 'Windows Media',
            album: live.album || '',
            albumArt: resolvedArt,
            isPlaying: live.is_playing,
            position: newPos,
            duration:
              live.duration_secs && live.duration_secs > 0 ? live.duration_secs : prev.duration,
            source: resolvedSource,
          };
        });

        if (live.is_playing) {
          if (pauseRetractTimer) {
            clearTimeout(pauseRetractTimer);
            pauseRetractTimer = null;
          }
          setMode((prev) => {
            if (prev === 'idle' || prev === 'hud-welcome') {
              return timerRef.current.isRunning ? 'split-media-timer' : 'compact-media';
            }
            return prev;
          });
        } else {
          // Paused: retract to idle after 3.5s if persistently paused in media mode
          if (pauseRetractTimer === null) {
            pauseRetractTimer = setTimeout(() => {
              // GUARD: Do NOT reset mode to idle if user is interacting or viewing hud-stats
              if (isUserInteractingRef.current || modeRef.current === 'hud-stats') {
                pauseRetractTimer = null;
                return;
              }
              setMode((prev) =>
                prev === 'compact-media' || prev === 'expanded-media' ? 'idle' : prev
              );
              pauseRetractTimer = null;
            }, 3500);
          }
        }
      } else {
        // Anti-Jitter: Do not instantly clear media on transient timeout!
        // Require 6 consecutive misses (~3000ms of complete silence) before declaring playback closed
        missedPollsRef.current += 1;
        if (missedPollsRef.current >= 6) {
          if (pauseRetractTimer) {
            clearTimeout(pauseRetractTimer);
            pauseRetractTimer = null;
          }
          setMediaTrack((prev) => ({
            ...prev,
            isPlaying: false,
            title: '',
            artist: '',
            album: '',
            albumArt: '',
            duration: 0,
            position: 0,
          }));
          // GUARD: Do NOT reset mode to idle if user is interacting or viewing hud-stats
          if (!isUserInteractingRef.current && modeRef.current !== 'hud-stats') {
            setMode((prev) => (prev === 'compact-media' || prev === 'expanded-media' ? 'idle' : prev));
          }
        }
      }
    };

    pollMedia();
    const interval = setInterval(pollMedia, 500);
    return () => {
      clearInterval(interval);
      if (pauseRetractTimer) clearTimeout(pauseRetractTimer);
    };
  }, []);

  // Real Windows battery status polling & auto MagSafe popup (only for devices with battery)
  useEffect(() => {
    let lastCharging = false;
    let initialCheck = true;
    const checkBattery = async () => {
      const bat = await nativeApi.getBatteryStatus();
      if (bat && bat.has_battery) {
        if (!initialCheck && bat.is_charging && !lastCharging) {
          sounds.playChime(settings.soundEnabled);
          setMode('hud-battery');
          setTimeout(() => {
            setMode((prev) =>
              prev === 'hud-battery' ? (mediaTrack.isPlaying ? 'compact-media' : 'idle') : prev
            );
          }, 3200);
        }
        lastCharging = bat.is_charging;
        initialCheck = false;
        setBattery({ level: bat.level, isCharging: bat.is_charging });
      }
    };
    checkBattery();
    const interval = setInterval(checkBattery, 2500);
    return () => clearInterval(interval);
  }, [settings.soundEnabled, mediaTrack.isPlaying]);

  const runningInTauri = isTauri();

  return (
    <div
      className={`relative min-h-screen w-full text-white overflow-hidden flex flex-col justify-between font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif] ${
        runningInTauri ? 'bg-transparent' : 'bg-[#050608]'
      }`}
    >
      {/* 4K macOS Sequoia Dynamic Wallpaper Background (Only in Browser Dev Mode) */}
      {!runningInTauri && (
        <div
          className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-90 transition-all duration-700"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=2000&q=85&fit=crop')`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
        </div>
      )}

      {/* macOS Top Menu Bar (Only in Browser Dev Mode) */}
      {!runningInTauri && (
        <header className="relative z-40 w-full h-[30px] px-4 flex items-center justify-between backdrop-blur-3xl bg-black/25 border-b border-white/[0.08] text-[13px] font-medium text-white/90 select-none">
        {/* Left: Apple logo & menu items */}
        <div className="flex items-center space-x-4">
          <span className="text-[15px] hover:opacity-70 cursor-pointer"></span>
          <span className="font-semibold text-white">Finder</span>
          <span className="hidden sm:inline hover:opacity-70 cursor-pointer">File</span>
          <span className="hidden sm:inline hover:opacity-70 cursor-pointer">Edit</span>
          <span className="hidden md:inline hover:opacity-70 cursor-pointer">View</span>
          <span className="hidden md:inline hover:opacity-70 cursor-pointer">Window</span>
          <span className="hidden md:inline hover:opacity-70 cursor-pointer">Help</span>
        </div>

        {/* Right: macOS status icons & time */}
        <div className="flex items-center space-x-3.5 text-xs text-white/85">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-mono">88%</span>
            <div className="w-5 h-2.5 rounded-[3px] border border-white/70 p-[1px] flex items-center">
              <div className="h-full bg-white rounded-[1px] w-[88%]" />
            </div>
          </div>
          <Wifi className="w-3.5 h-3.5" />
          <Search className="w-3.5 h-3.5" />
          <div className="flex items-center space-x-1">
            <span className="w-3 h-3 rounded-full bg-white/20 flex items-center justify-center text-[8px]">
              ⊞
            </span>
          </div>
          <span className="font-medium text-[12px] tracking-tight">Fri Sep 11 9:41 PM</span>
        </div>
      </header>
    )}

      {/* Floating Dynamic Island at Top Center */}
      <div className="fixed top-0 left-0 w-full z-50 pointer-events-auto">
        <IslandContainer
          mode={mode}
          settings={settings}
          mediaTrack={mediaTrack}
          volume={volume}
          brightness={brightness}
          battery={battery}
          bluetoothDevice={bluetoothDevice}
          timer={timer}
          stats={systemStats}
          isCapsLockOn={isCapsLockOn}
          isMenuOpen={contextMenu}
          clipboardText={clipboardText}
          downloadInfo={downloadInfo}
          onFocusMediaApp={handleFocusMediaApp}
          shelfItems={shelfItems}
          onRemoveShelfItem={handleRemoveShelfItem}
          onOpenShelfFile={handleOpenShelfFile}
          onDropShelfFiles={handleDropShelfFiles}
          onContextMenu={() => setContextMenu((prev) => !prev)}
          onToggleMenu={() => setContextMenu((prev) => !prev)}
          onInteractionChange={handleInteractionChange}
          onModeChange={(newMode) => setMode(newMode)}
          onMediaToggle={() => {
            sounds.playClick(settings.soundEnabled);
            nativeApi.playPauseMedia();
            setMediaTrack((prev) => ({ ...prev, isPlaying: !prev.isPlaying }));
          }}
          onMediaNext={() => {
            sounds.playClick(settings.soundEnabled);
            nativeApi.nextMedia();
            const nextIdx = (trackIndex + 1) % TRACKS.length;
            setTrackIndex(nextIdx);
            if (!mediaTrack.title) {
              setMediaTrack(TRACKS[nextIdx]);
            }
          }}
          onMediaPrev={() => {
            sounds.playClick(settings.soundEnabled);
            nativeApi.prevMedia();
            setMediaTrack((prev) => ({ ...prev, position: 0 }));
          }}
          onMediaSeek={(sec) => {
            lastSeekTimeRef.current = Date.now();
            const targetSec = Math.max(0, Math.round(sec));
            setMediaTrack((prev) => ({ ...prev, position: targetSec }));
            nativeApi.seekMedia(targetSec);
          }}
          onOpenSoundSettings={handleOpenSoundSettings}
          onVolumeChange={(val) => {
            sounds.playClick(settings.soundEnabled);
            setVolume({ level: val, isMuted: val === 0 });
            nativeApi.setSystemVolume(val);
          }}
          onToggleMute={async () => {
            sounds.playClick(settings.soundEnabled);
            const newMuted = await nativeApi.toggleMute();
            setVolume((prev) => ({ ...prev, isMuted: newMuted }));
          }}
          onBrightnessChange={(val) => {
            sounds.playClick(settings.soundEnabled);
            setBrightness(val);
          }}
          onTimerToggle={() => {
            sounds.playClick(settings.soundEnabled);
            setTimer((prev) => ({ ...prev, isRunning: !prev.isRunning }));
          }}
          onTimerReset={() => {
            sounds.playClick(settings.soundEnabled);
            setTimer((prev) => ({ ...prev, remainingSeconds: prev.totalSeconds, isRunning: false }));
            setMode((prev) => {
              if (prev === 'compact-timer' || prev === 'expanded-timer') {
                return mediaTrackRef.current.isPlaying ? 'compact-media' : 'idle';
              }
              return prev;
            });
          }}
          onTimerSetSeconds={(sec) => {
            sounds.playClick(settings.soundEnabled);
            setTimer((prev) => ({
              ...prev,
              totalSeconds: sec,
              remainingSeconds: sec,
              isRunning: true,
            }));
          }}
        />

        {/* Right-click Context Menu */}
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(false)}
            />
            <div
              className="flex justify-center w-full mt-2 select-none relative z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-2 rounded-2xl bg-black/95 border border-white/20 backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] text-xs text-white space-y-1 w-52">
                <div className="px-3 py-1 text-[10px] font-semibold text-white/40 uppercase tracking-wider border-b border-white/10 mb-1 flex items-center justify-between">
                  <span>Dynamic Island</span>
                  <span className="text-[9px] text-emerald-400 font-mono">Real-Time</span>
                </div>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setMode('idle');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Chế độ nghỉ</span>
                  <span className="text-[10px] text-white/40">Idle</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    if (!mediaTrack.title) {
                      setMediaTrack(TRACKS[0]);
                    }
                    setMode('compact-media');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Nhạc thu gọn</span>
                  <span className="text-[10px] text-white/40">Compact</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    if (!mediaTrack.title) {
                      setMediaTrack(TRACKS[0]);
                    }
                    setMode('expanded-media');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Nhạc bung rộng</span>
                  <span className="text-[10px] text-white/40">Expanded</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setMode('drop-shelf');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Drop Shelf (Kéo thả)</span>
                  <span className="text-[10px] text-cyan-400">Files</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setMode('hud-volume');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Âm lượng Windows</span>
                  <span className="text-[10px] text-emerald-400">
                    {volume.isMuted ? 'Muted' : `${volume.level}%`}
                  </span>
                </button>
                <button
                  onClick={async () => {
                    sounds.playClick(settings.soundEnabled);
                    const newMuted = await nativeApi.toggleMute();
                    setVolume((prev) => ({ ...prev, isMuted: newMuted }));
                    setMode('hud-mute');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Chế độ Im lặng (Mute)</span>
                  <span className={`text-[10px] ${volume.isMuted ? 'text-rose-400' : 'text-white/40'}`}>
                    {volume.isMuted ? 'Đang tắt' : 'Đang bật'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setMode('hud-bluetooth');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span className="truncate max-w-[130px]">Thiết bị: {bluetoothDevice.name}</span>
                  <span className="text-[10px] text-emerald-400">Active</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setMode('hud-stats');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>RAM & Hệ Thống</span>
                  <span className="text-[10px] text-emerald-400">
                    {systemStats ? `${systemStats.ram_percent}%` : 'Real'}
                  </span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    nativeApi.launchTaskManager();
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Trình quản lý tác vụ</span>
                  <span className="text-[10px] text-sky-400">TaskMgr</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    sounds.playChime(settings.soundEnabled);
                    setMode('hud-battery');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Pin & Sạc (MagSafe)</span>
                  <span className="text-[10px] text-emerald-400">Chime</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setMode('compact-timer');
                    setContextMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>Đồng hồ hẹn giờ</span>
                  <span className="text-[10px] text-amber-400">Timer</span>
                </button>
                <button
                  onClick={() => {
                    sounds.playClick(settings.soundEnabled);
                    setContextMenu(false);
                    nativeApi.exitApp();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20 flex items-center justify-between cursor-pointer border-t border-white/10 pt-1.5 mt-1"
                >
                  <span>Thoát ứng dụng</span>
                  <span className="text-[10px] text-rose-400/60">Exit</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Center Desktop Space (Only in Browser Demo) */}
      {!runningInTauri && (
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-center drop-shadow-2xl">
            <p className="text-sm font-semibold tracking-wider text-white/50 uppercase mb-1">
              Dynamic Island for Windows
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white/95">
              macOS Liquid Glass
            </h1>
            <p className="text-xs text-white/60 mt-2 max-w-md mx-auto">
              Click the island at the top to expand or collapse. Use the macOS Dock below to test live states.
            </p>
          </div>
        </div>
      )}

      {/* Sleek macOS Floating Dock Controller at Bottom (Browser Demo Mode Only) */}
      {!runningInTauri && (
        <footer className="relative z-40 pb-6 flex flex-col items-center select-none">
        {/* Settings Flyout */}
        {showSettings && (
          <div className="mb-4 p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-2xl shadow-2xl text-xs w-72 text-white space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10 font-semibold">
              <span>Tùy Chỉnh Đảo</span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div>
              <div className="flex justify-between text-white/60 mb-1">
                <span>Top Offset</span>
                <span>{settings.topOffset}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={settings.topOffset}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, topOffset: parseInt(e.target.value) }))
                }
                className="w-full h-1 bg-white/20 rounded accent-white"
              />
            </div>
            <div>
              <div className="flex justify-between text-white/60 mb-1">
                <span>Scale</span>
                <span>{settings.scale}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={settings.scale}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, scale: parseFloat(e.target.value) }))
                }
                className="w-full h-1 bg-white/20 rounded accent-white"
              />
            </div>
            <label className="flex items-center space-x-2 text-white/70 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, soundEnabled: e.target.checked }))
                }
                className="rounded accent-white"
              />
              <span>Âm thanh Apple UI</span>
            </label>
          </div>
        )}

        {/* Floating macOS Dock Bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-[22px] bg-black/40 border border-white/[0.12] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
          <button
            onClick={() => {
              sounds.playClick(settings.soundEnabled);
              setMode('idle');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              mode === 'idle'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Chế độ nghỉ"
          >
            <span className="w-2 h-2 rounded-full bg-white/40" />
            <span>Idle</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick(settings.soundEnabled);
              setMode(mode === 'expanded-media' ? 'compact-media' : 'expanded-media');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              mode === 'compact-media' || mode === 'expanded-media'
                ? 'bg-[#fa2d48]/30 text-rose-300 font-medium border border-rose-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Music Player"
          >
            <Music className="w-3.5 h-3.5" />
            <span>{mode === 'expanded-media' ? 'Expanded' : 'Music'}</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick(settings.soundEnabled);
              setMode('hud-volume');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              mode === 'hud-volume'
                ? 'bg-white/20 text-white font-medium shadow-inner'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Volume HUD"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Volume</span>
          </button>

          <button
            onClick={() => {
              sounds.playChime(settings.soundEnabled);
              setBattery((prev) => ({ ...prev, isCharging: !prev.isCharging }));
              setMode('hud-battery');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              mode === 'hud-battery'
                ? 'bg-[#30d158]/30 text-emerald-300 font-medium border border-[#30d158]/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="MagSafe Charging HUD"
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            <span>Battery</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick(settings.soundEnabled);
              setMode('hud-bluetooth');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              mode === 'hud-bluetooth'
                ? 'bg-sky-500/30 text-sky-300 font-medium border border-sky-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="AirPods Pro HUD"
          >
            <Headphones className="w-3.5 h-3.5" />
            <span>AirPods</span>
          </button>

          <button
            onClick={() => {
              sounds.playClick(settings.soundEnabled);
              setMode(mode === 'expanded-timer' ? 'compact-timer' : 'expanded-timer');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              mode === 'compact-timer' || mode === 'expanded-timer'
                ? 'bg-amber-500/30 text-amber-300 font-medium border border-amber-500/30'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Timer"
          >
            <Timer className="w-3.5 h-3.5" />
            <span>Timer</span>
          </button>

          <div className="w-[1px] h-4 bg-white/15 mx-1" />

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-xl text-xs transition-all cursor-pointer ${
              showSettings
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:text-white hover:bg-white/10'
            }`}
            title="Settings"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    )}
  </div>
  );
}

export default App;
