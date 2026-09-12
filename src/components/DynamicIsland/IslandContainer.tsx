import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  IslandMode,
  MediaTrack,
  VolumeState,
  BatteryState,
  BluetoothDevice,
  TimerState,
  IslandSettings,
} from '../../types/island';
import { IdleView } from './views/IdleView';
import { CompactMediaView } from './views/CompactMediaView';
import { ExpandedMediaView } from './views/ExpandedMediaView';
import { VolumeHudView } from './views/VolumeHudView';
import { BrightnessHudView } from './views/BrightnessHudView';
import { BatteryHudView } from './views/BatteryHudView';
import { BluetoothHudView } from './views/BluetoothHudView';
import { TimerView } from './views/TimerView';
import { DropShelfView, type DroppedItem } from './views/DropShelfView';
import { AppleControlCenterView } from './views/AppleControlCenterView';
import { ClipboardHudView } from './views/ClipboardHudView';
import { MuteHudView } from './views/MuteHudView';
import { CapsLockHudView } from './views/CapsLockHudView';
import { WelcomeHudView } from './views/WelcomeHudView';
import { SplitIslandView } from './views/SplitIslandView';
import { DownloadHudView, type DownloadHudProps } from './views/DownloadHudView';
import { sounds } from '../../utils/audio';
import { nativeApi, type NativeSystemStats } from '../../utils/native';

interface IslandContainerProps {
  mode: IslandMode;
  settings: IslandSettings;
  mediaTrack: MediaTrack;
  volume: VolumeState;
  brightness: number;
  battery: BatteryState;
  bluetoothDevice: BluetoothDevice;
  timer: TimerState;
  stats?: NativeSystemStats | null;
  isCapsLockOn?: boolean;
  isMenuOpen?: boolean;
  clipboardText?: string | null;
  downloadInfo?: DownloadHudProps | null;
  onFocusMediaApp?: () => void;
  shelfItems?: DroppedItem[];
  onRemoveShelfItem?: (id: string) => void;
  onOpenShelfFile?: (path: string) => void;
  onDropShelfFiles?: (files: File[]) => void;
  onContextMenu?: () => void;
  onToggleMenu?: () => void;
  onModeChange: (mode: IslandMode) => void;
  onMediaToggle: () => void;
  onMediaNext: () => void;
  onMediaPrev: () => void;
  onMediaSeek: (sec: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute?: () => void;
  onBrightnessChange: (val: number) => void;
  onTimerToggle: () => void;
  onTimerReset: () => void;
  onTimerSetSeconds?: (sec: number) => void;
  onOpenSoundSettings?: () => void;
  onInteractionChange?: (active: boolean) => void;
}

export const IslandContainer: React.FC<IslandContainerProps> = ({
  mode,
  settings,
  mediaTrack,
  volume,
  brightness,
  battery,
  bluetoothDevice,
  timer,
  stats,
  isCapsLockOn,
  isMenuOpen = false,
  clipboardText,
  downloadInfo,
  onFocusMediaApp,
  shelfItems,
  onRemoveShelfItem,
  onOpenShelfFile,
  onDropShelfFiles,
  onContextMenu,
  onToggleMenu,
  onModeChange,
  onMediaToggle,
  onMediaNext,
  onMediaPrev,
  onMediaSeek,
  onVolumeChange,
  onToggleMute,
  onBrightnessChange,
  onTimerToggle,
  onTimerReset,
  onTimerSetSeconds,
  onOpenSoundSettings,
  onInteractionChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverDwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousModeRef = useRef<IslandMode>('idle');

  // Track active Win32 window size state and shrink timer
  const isWindowLargeRef = useRef(false);
  const windowShrinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setWindowSize = useCallback((targetH: number) => {
    if (windowShrinkTimerRef.current) {
      clearTimeout(windowShrinkTimerRef.current);
      windowShrinkTimerRef.current = null;
    }
    nativeApi.centerAtTop(420, targetH);
    isWindowLargeRef.current = true;
  }, []);

  const scheduleWindowShrink = useCallback((delayMs: number = 460) => {
    if (windowShrinkTimerRef.current) {
      clearTimeout(windowShrinkTimerRef.current);
    }
    windowShrinkTimerRef.current = setTimeout(() => {
      nativeApi.centerAtTop(420, 68);
      isWindowLargeRef.current = false;
      windowShrinkTimerRef.current = null;
    }, delayMs);
  }, []);

  // Exact Apple HIG dimensions and squircle border-radii
  const getIslandDimensions = () => {
    switch (mode) {
      case 'idle':
        return { width: 136, height: 32, borderRadius: 16, isPill: true };
      case 'compact-media':
        return { width: 218, height: 32, borderRadius: 16, isPill: true };
      case 'compact-timer':
        return { width: 156, height: 32, borderRadius: 16, isPill: true };
      case 'split-media-timer':
        return { width: 260, height: 32, borderRadius: 16, isPill: true };
      case 'hud-download':
        return { width: 248, height: 34, borderRadius: 17, isPill: true };
      case 'hud-volume':
        return { width: 220, height: 34, borderRadius: 17, isPill: true };
      case 'hud-brightness':
        return { width: 220, height: 34, borderRadius: 17, isPill: true };
      case 'hud-battery':
        return { width: 220, height: 34, borderRadius: 17, isPill: true };
      case 'hud-bluetooth':
        return { width: 280, height: 44, borderRadius: 22, isPill: false };
      case 'hud-stats':
        return { width: 380, height: 210, borderRadius: 38, isPill: false };
      case 'hud-clipboard':
        return { width: 310, height: 42, borderRadius: 21, isPill: false };
      case 'hud-mute':
        return { width: 220, height: 34, borderRadius: 17, isPill: true };
      case 'hud-capslock':
        return { width: 190, height: 32, borderRadius: 16, isPill: true };
      case 'hud-welcome':
        return { width: 300, height: 44, borderRadius: 22, isPill: false };
      case 'expanded-media':
        return { width: 370, height: 172, borderRadius: 44, isPill: false };
      case 'expanded-timer':
        return { width: 310, height: 130, borderRadius: 36, isPill: false };
      case 'drop-shelf':
        return { width: 380, height: 150, borderRadius: 38, isPill: false };
      default:
        return { width: 136, height: 32, borderRadius: 16, isPill: true };
    }
  };

  const dims = getIslandDimensions();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (hoverDwellTimerRef.current) {
      clearTimeout(hoverDwellTimerRef.current);
      hoverDwellTimerRef.current = null;
    }

    if (mode === 'compact-media') {
      previousModeRef.current = mode;
      setWindowSize(260);
      sounds.playExpand(settings.soundEnabled);
      setIsHovered(true);
      onInteractionChange?.(true);
      onModeChange('expanded-media');
    } else if (mode === 'idle' || mode === 'split-media-timer') {
      previousModeRef.current = mode;
      // Tick 0 Win32 pre-sizing BEFORE state change
      setWindowSize(260);
      sounds.playExpand(settings.soundEnabled);
      setIsHovered(true);
      onInteractionChange?.(true);
      onModeChange('hud-stats');
    } else if (mode === 'hud-stats') {
      sounds.playCollapse(settings.soundEnabled);
      setIsHovered(false);
      onInteractionChange?.(false);
      const revertTarget =
        previousModeRef.current &&
        previousModeRef.current !== 'hud-stats' &&
        previousModeRef.current !== 'expanded-media'
          ? previousModeRef.current
          : mediaTrack.isPlaying && timer.isRunning
          ? 'split-media-timer'
          : mediaTrack.isPlaying
          ? 'compact-media'
          : 'idle';
      onModeChange(revertTarget);
    } else if (mode === 'expanded-media') {
      sounds.playCollapse(settings.soundEnabled);
      setIsHovered(false);
      onInteractionChange?.(false);
      if (mediaTrack.isPlaying && timer.isRunning) {
        onModeChange('split-media-timer');
      } else {
        onModeChange(mediaTrack.isPlaying ? 'compact-media' : 'idle');
      }
    } else if (mode === 'compact-timer') {
      previousModeRef.current = mode;
      setWindowSize(260);
      sounds.playExpand(settings.soundEnabled);
      setIsHovered(true);
      onInteractionChange?.(true);
      onModeChange('expanded-timer');
    } else if (mode === 'expanded-timer') {
      sounds.playCollapse(settings.soundEnabled);
      setIsHovered(false);
      onInteractionChange?.(false);
      if (mediaTrack.isPlaying && timer.isRunning) {
        onModeChange('split-media-timer');
      } else {
        onModeChange('compact-timer');
      }
    } else if (
      mode === 'hud-clipboard' ||
      mode === 'hud-volume' ||
      mode === 'hud-mute' ||
      mode === 'hud-capslock' ||
      mode === 'hud-battery' ||
      mode === 'hud-bluetooth' ||
      mode === 'hud-download'
    ) {
      sounds.playCollapse(settings.soundEnabled);
      setIsHovered(false);
      onInteractionChange?.(false);
      if (mediaTrack.isPlaying && timer.isRunning) {
        onModeChange('split-media-timer');
      } else if (mediaTrack.isPlaying) {
        onModeChange('compact-media');
      } else if (timer.isRunning) {
        onModeChange('compact-timer');
      } else {
        onModeChange('idle');
      }
    }
  };

  // Zero-Click Dynamic Hover: Automatically blooms open on mouse enter with 60ms dwell debounce
  const handleMouseEnter = () => {
    if (collapseTimeoutRef.current) {
      clearTimeout(collapseTimeoutRef.current);
      collapseTimeoutRef.current = null;
    }
    if (windowShrinkTimerRef.current) {
      clearTimeout(windowShrinkTimerRef.current);
      windowShrinkTimerRef.current = null;
    }
    if (hoverDwellTimerRef.current) {
      clearTimeout(hoverDwellTimerRef.current);
      hoverDwellTimerRef.current = null;
    }

    const isAlreadyLarge =
      mode === 'hud-stats' ||
      mode === 'expanded-media' ||
      mode === 'expanded-timer' ||
      mode === 'drop-shelf';

    if (isAlreadyLarge) {
      setIsHovered(true);
      onInteractionChange?.(true);
      const targetH = Math.max(dims.height + 26, isMenuOpen ? 340 : 260);
      setWindowSize(targetH);
      return;
    }

    if (
      mode === 'idle' ||
      mode === 'compact-media' ||
      mode === 'compact-timer' ||
      mode === 'split-media-timer'
    ) {
      previousModeRef.current = mode;
    }

    // 60ms entrance dwell debounce: prevents rapid boundary flicker loops
    hoverDwellTimerRef.current = setTimeout(() => {
      setIsHovered(true);
      onInteractionChange?.(true);

      if (settings.autoExpandOnHover) {
        if (mode === 'compact-media') {
          // Direct expand to Dedicated Music Player with Scrubber & Waveform
          setWindowSize(260);
          sounds.playExpand(settings.soundEnabled);
          onModeChange('expanded-media');
        } else if (mode === 'idle' || mode === 'split-media-timer') {
          // Direct expand to Full Control Center HUD
          setWindowSize(260);
          sounds.playExpand(settings.soundEnabled);
          onModeChange('hud-stats');
        } else if (mode === 'compact-timer') {
          setWindowSize(260);
          sounds.playExpand(settings.soundEnabled);
          onModeChange('expanded-timer');
        }
      }
      hoverDwellTimerRef.current = null;
    }, 60);
  };

  // Zero-Click Dynamic Retract: Automatically collapses back when cursor moves away
  const handleMouseLeave = () => {
    if (hoverDwellTimerRef.current) {
      clearTimeout(hoverDwellTimerRef.current);
      hoverDwellTimerRef.current = null;
    }

    setIsHovered(false);

    if (settings.autoExpandOnHover) {
      if (
        mode === 'expanded-media' ||
        mode === 'expanded-timer' ||
        mode === 'hud-stats' ||
        mode === 'drop-shelf'
      ) {
        collapseTimeoutRef.current = setTimeout(() => {
          sounds.playCollapse(settings.soundEnabled);
          onInteractionChange?.(false);
          const collapseTarget =
            previousModeRef.current &&
            previousModeRef.current !== 'hud-stats' &&
            previousModeRef.current !== 'expanded-media'
              ? previousModeRef.current
              : mediaTrack.isPlaying && timer.isRunning
              ? 'split-media-timer'
              : mediaTrack.isPlaying
              ? 'compact-media'
              : 'idle';
          onModeChange(collapseTarget);
          collapseTimeoutRef.current = null;
        }, settings.collapseDelayMs || 400);
      } else {
        onInteractionChange?.(false);
      }
    } else {
      onInteractionChange?.(false);
    }
  };

  // 120 FPS Fluid Optimization:
  // All compact pill modes share a stable 420x68 native window.
  // Native window is only resized when expanding into a large card or opening the context menu.
  // 420ms shrink coordination maintains 260px native window height during Framer-Motion spring collapse.
  const isCurrentlyLarge = dims.height > 60 || isMenuOpen;

  useEffect(() => {
    if (isCurrentlyLarge) {
      const targetH = Math.max(dims.height + 26, isMenuOpen ? 340 : 260);
      setWindowSize(targetH);
    } else {
      scheduleWindowShrink(460);
    }
  }, [isCurrentlyLarge, dims.height, isMenuOpen, setWindowSize, scheduleWindowShrink]);

  useEffect(() => {
    return () => {
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
      if (hoverDwellTimerRef.current) clearTimeout(hoverDwellTimerRef.current);
      if (windowShrinkTimerRef.current) clearTimeout(windowShrinkTimerRef.current);
    };
  }, []);

  return (
    <div
      className="flex justify-center w-full select-none"
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (mode !== 'drop-shelf') {
          previousModeRef.current = mode;
          onModeChange('drop-shelf');
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0 && onDropShelfFiles) {
          onDropShelfFiles(files);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu?.();
        onToggleMenu?.();
      }}
      style={{
        paddingTop: `${settings.topOffset}px`,
        transform: `scale(${settings.scale})`,
        transformOrigin: 'top center',
      }}
    >
      <div
        className="relative inline-flex flex-col items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Extended hover hitbox flush to monitor top edge (y=0) to prevent boundary flicker loops */}
        <div
          className="absolute left-0 right-0 pointer-events-auto"
          style={{
            top: `-${settings.topOffset}px`,
            height: `${settings.topOffset}px`,
          }}
        />
        <motion.div
          onClick={handleClick}
          whileHover={{ scale: mode === 'split-media-timer' ? 1.0 : 1.018 }}
          whileTap={{ scale: mode === 'split-media-timer' ? 1.0 : 0.98 }}
        className={`relative ${mode === 'split-media-timer' ? 'bg-transparent shadow-none' : 'bg-black'} text-white cursor-pointer overflow-hidden transform-gpu will-change-[width,height,border-radius] ${
          mode === 'split-media-timer' ? '' : (dims.isPill ? 'apple-pill-shadow' : 'apple-island-shadow')
        } ${isHovered && mode !== 'split-media-timer' ? 'shadow-[0_0_24px_rgba(255,255,255,0.12)]' : ''} transition-shadow duration-200`}
        animate={{
          width: dims.width,
          height: dims.height,
          borderRadius: dims.borderRadius,
        }}
        transition={{
          type: 'spring',
          stiffness: dims.isPill ? 460 : 420,
          damping: dims.isPill ? 38 : 32,
          mass: dims.isPill ? 0.7 : 0.75,
        }}
        style={{
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="w-full h-full flex items-center justify-center"
          >
            {mode === 'idle' && (
              <IdleView
                stats={stats}
                isCapsLockOn={isCapsLockOn}
                timer={timer}
                mediaTrack={mediaTrack}
              />
            )}

            {mode === 'hud-welcome' && <WelcomeHudView />}

            {mode === 'compact-media' && (
              <CompactMediaView
                track={mediaTrack}
                onFocusApp={onFocusMediaApp}
                onExpand={() => {
                  previousModeRef.current = 'compact-media';
                  setWindowSize(260);
                  sounds.playExpand(settings.soundEnabled);
                  setIsHovered(true);
                  onInteractionChange?.(true);
                  onModeChange('expanded-media');
                }}
              />
            )}

            {mode === 'split-media-timer' && (
              <SplitIslandView
                mediaTrack={mediaTrack}
                timer={timer}
                onExpandMedia={() => {
                  previousModeRef.current = 'split-media-timer';
                  setWindowSize(260);
                  sounds.playExpand(settings.soundEnabled);
                  setIsHovered(true);
                  onInteractionChange?.(true);
                  onModeChange('expanded-media');
                }}
                onExpandTimer={() => {
                  previousModeRef.current = 'split-media-timer';
                  setWindowSize(260);
                  sounds.playExpand(settings.soundEnabled);
                  setIsHovered(true);
                  onInteractionChange?.(true);
                  onModeChange('expanded-timer');
                }}
                onFocusApp={onFocusMediaApp}
              />
            )}

            {mode === 'hud-download' && (
              <DownloadHudView
                filename={downloadInfo?.filename || 'Đang tải tệp...'}
                speedKbps={downloadInfo?.speedKbps || 0}
                downloadedBytes={downloadInfo?.downloadedBytes || 0}
                isComplete={downloadInfo?.isComplete || false}
                filePath={downloadInfo?.filePath}
                onClick={downloadInfo?.onClick}
              />
            )}

            {mode === 'expanded-media' && (
              <ExpandedMediaView
                track={mediaTrack}
                onTogglePlay={onMediaToggle}
                onNext={onMediaNext}
                onPrevious={onMediaPrev}
                onSeek={onMediaSeek}
                onOpenSoundSettings={onOpenSoundSettings}
                onSwitchToStats={() => {
                  sounds.playClick();
                  setWindowSize(260);
                  onModeChange('hud-stats');
                }}
              />
            )}

            {mode === 'hud-volume' && (
              <VolumeHudView volume={volume} onVolumeChange={onVolumeChange} />
            )}

            {mode === 'hud-brightness' && (
              <BrightnessHudView
                level={brightness}
                onBrightnessChange={onBrightnessChange}
              />
            )}

            {mode === 'hud-battery' && <BatteryHudView battery={battery} />}

            {mode === 'hud-bluetooth' && <BluetoothHudView device={bluetoothDevice} />}

            {mode === 'hud-stats' && (
              <AppleControlCenterView
                mediaTrack={mediaTrack}
                volume={volume}
                battery={battery}
                bluetoothDevice={bluetoothDevice}
                timer={timer}
                stats={stats}
                onVolumeChange={onVolumeChange}
                onToggleMute={onToggleMute ?? (() => {})}
                onMediaToggle={onMediaToggle}
                onMediaNext={onMediaNext}
                onMediaPrev={onMediaPrev}
                onTimerToggle={onTimerToggle}
                onTimerReset={onTimerReset}
                onTimerSetSeconds={onTimerSetSeconds ?? (() => {})}
                clipboardText={clipboardText}
                onOpenSoundSettings={onOpenSoundSettings}
                onSwitchToMedia={() => {
                  sounds.playClick();
                  setWindowSize(260);
                  onModeChange('expanded-media');
                }}
              />
            )}

            {mode === 'hud-clipboard' && (
              <ClipboardHudView text={clipboardText ?? ''} />
            )}

            {mode === 'hud-mute' && <MuteHudView isMuted={volume.isMuted} />}

            {mode === 'hud-capslock' && <CapsLockHudView isOn={isCapsLockOn ?? false} />}

            {(mode === 'compact-timer' || mode === 'expanded-timer') && (
              <TimerView
                timer={timer}
                isExpanded={mode === 'expanded-timer'}
                onToggleTimer={onTimerToggle}
                onResetTimer={onTimerReset}
              />
            )}

            {mode === 'drop-shelf' && (
              <DropShelfView
                items={shelfItems}
                onRemoveItem={onRemoveShelfItem}
                onOpenFile={onOpenShelfFile}
                onDropFiles={onDropShelfFiles}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  </div>
);
};
