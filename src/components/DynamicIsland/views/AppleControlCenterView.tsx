import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Timer,
  Clipboard,
  Check,
  Zap,
  Battery,
  Music,
} from 'lucide-react';
import type {
  MediaTrack,
  VolumeState,
  BatteryState,
  BluetoothDevice,
  TimerState,
} from '../../../types/island';
import { nativeApi, type NativeSystemStats } from '../../../utils/native';
import { sounds } from '../../../utils/audio';

interface AppleControlCenterViewProps {
  mediaTrack: MediaTrack;
  volume: VolumeState;
  battery: BatteryState;
  bluetoothDevice: BluetoothDevice;
  timer: TimerState;
  stats?: NativeSystemStats | null;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onMediaToggle: () => void;
  onMediaNext: () => void;
  onMediaPrev: () => void;
  onTimerToggle: () => void;
  onTimerReset: () => void;
  onTimerSetSeconds: (sec: number) => void;
  clipboardText?: string | null;
  onLaunchTaskManager?: () => void;
  onOpenSoundSettings?: () => void;
  onSwitchToMedia?: () => void;
}

export const AppleControlCenterView: React.FC<AppleControlCenterViewProps> = ({
  mediaTrack,
  volume,
  battery,
  bluetoothDevice,
  timer,
  stats,
  onVolumeChange,
  onToggleMute,
  onMediaToggle,
  onMediaNext,
  onMediaPrev,
  onTimerToggle,
  onTimerSetSeconds,
  clipboardText,
  onLaunchTaskManager,
  onOpenSoundSettings,
  onSwitchToMedia,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    sounds.playClick();
    if (clipboardText) {
      const ok = await nativeApi.copyToClipboard(clipboardText);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Activity Rings Calculations
  const cpuPercent = Math.min(100, Math.max(2, stats?.cpu_percent ?? 5));
  const ramPercent = Math.min(100, Math.max(4, stats?.ram_percent ?? 40));
  const batPercent = Math.min(100, Math.max(5, battery.level));

  // Concentric ring radii & circumferences
  const rCpu = 28;
  const circCpu = 2 * Math.PI * rCpu;
  const offsetCpu = circCpu - (cpuPercent / 100) * circCpu;

  const rRam = 20;
  const circRam = 2 * Math.PI * rRam;
  const offsetRam = circRam - (ramPercent / 100) * circRam;

  const rBat = 12;
  const circBat = 2 * Math.PI * rBat;
  const offsetBat = circBat - (batPercent / 100) * circBat;

  const isDraggingVolumeRef = React.useRef(false);

  const updateVolumeFromPointer = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const val = Math.round(ratio * 100);
    onVolumeChange(val);
    nativeApi.setSystemVolume(val);
  };

  const handleVolumePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isDraggingVolumeRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    sounds.playClick();
    updateVolumeFromPointer(e.clientX, e.currentTarget);
  };

  const handleVolumePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingVolumeRef.current) return;
    e.stopPropagation();
    updateVolumeFromPointer(e.clientX, e.currentTarget);
  };

  const handleVolumePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingVolumeRef.current) return;
    e.stopPropagation();
    isDraggingVolumeRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    updateVolumeFromPointer(e.clientX, e.currentTarget);
  };

  return (
    <div className="flex flex-col justify-between w-full h-full p-3 text-white select-none overflow-hidden font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif]">
      {/* 1. TOP MODULE: Apple Music / SMTC Bar (Click to open Dedicated Music Player) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          sounds.playClick();
          onSwitchToMedia?.();
        }}
        className="flex items-center justify-between gap-3 bg-white/[0.07] hover:bg-white/[0.12] transition-colors cursor-pointer backdrop-blur-md rounded-[18px] p-2 border border-white/[0.09]"
        title="Nhấn để mở Trình phát nhạc chi tiết (Scrubber, Waveform)"
      >
        {/* Album Artwork Squircle */}
        <div className="relative shrink-0 w-10 h-10 rounded-[11px] overflow-hidden bg-[#1c1c1e] shadow-[0_2px_10px_rgba(0,0,0,0.6)] flex items-center justify-center">
          {mediaTrack.albumArt ? (
            <img
              src={mediaTrack.albumArt}
              alt={mediaTrack.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#fa2d48] to-[#c71a32] flex items-center justify-center text-white">
              <Music className="w-4 h-4 fill-current" />
            </div>
          )}
        </div>

        {/* Track Title & Artist */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-[13px] font-semibold text-white truncate tracking-tight leading-tight">
            {mediaTrack.title || 'Apple Music'}
          </div>
          <div className="text-[11px] font-normal text-[#86868b] truncate mt-0.5">
            {mediaTrack.artist || 'Spotify / YouTube / Windows'}
          </div>
        </div>

        {/* Apple Playback Controls */}
        <div className="flex items-center gap-2.5 shrink-0 pr-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              onMediaPrev();
            }}
            className="text-white/70 hover:text-white transition-colors active:scale-90 p-1 cursor-pointer"
            title="Bài trước"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              onMediaToggle();
            }}
            className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
            title={mediaTrack.isPlaying ? 'Tạm dừng' : 'Phát'}
          >
            {mediaTrack.isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              onMediaNext();
            }}
            className="text-white/70 hover:text-white transition-colors active:scale-90 p-1 cursor-pointer"
            title="Bài tiếp theo"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* 2. MIDDLE BENTO ROW: Concentric Activity Rings + iOS 18 Volume Capsule */}
      <div className="grid grid-cols-2 gap-2 my-auto">
        {/* Left: Apple Watch / macOS Activity Rings */}
        <div
          className="flex items-center gap-2.5 bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-md rounded-[18px] p-2 border border-white/[0.09] cursor-pointer transition-all duration-200"
          onClick={(e) => {
            e.stopPropagation();
            sounds.playClick();
            if (onLaunchTaskManager) {
              onLaunchTaskManager();
            } else {
              nativeApi.launchTaskManager();
            }
          }}
          title="Mở Task Manager (taskmgr.exe)"
        >
          {/* Concentric SVG Rings */}
          <div
            className="relative w-16 h-16 shrink-0 flex items-center justify-center cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              if (onLaunchTaskManager) {
                onLaunchTaskManager();
              } else {
                nativeApi.launchTaskManager();
              }
            }}
            title="Mở Task Manager (taskmgr.exe)"
          >
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 70 70">
              {/* CPU Ring Background */}
              <circle
                cx="35"
                cy="35"
                r={rCpu}
                stroke="#64d2ff"
                strokeWidth="4.5"
                fill="none"
                opacity="0.18"
              />
              {/* CPU Ring Progress */}
              <circle
                cx="35"
                cy="35"
                r={rCpu}
                stroke="#64d2ff"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circCpu}
                strokeDashoffset={offsetCpu}
                className="transition-all duration-500 ease-out"
              />

              {/* RAM Ring Background */}
              <circle
                cx="35"
                cy="35"
                r={rRam}
                stroke="#30d158"
                strokeWidth="4.5"
                fill="none"
                opacity="0.18"
              />
              {/* RAM Ring Progress */}
              <circle
                cx="35"
                cy="35"
                r={rRam}
                stroke="#30d158"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circRam}
                strokeDashoffset={offsetRam}
                className="transition-all duration-500 ease-out"
              />

              {/* Battery / Power Ring Background */}
              <circle
                cx="35"
                cy="35"
                r={rBat}
                stroke="#ff9f0a"
                strokeWidth="4.5"
                fill="none"
                opacity="0.18"
              />
              {/* Battery / Power Ring Progress */}
              <circle
                cx="35"
                cy="35"
                r={rBat}
                stroke="#ff9f0a"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
                strokeDasharray={circBat}
                strokeDashoffset={offsetBat}
                className="transition-all duration-500 ease-out"
              />
            </svg>
          </div>

          {/* Activity Legend */}
          <div className="flex flex-col justify-center space-y-0.5 text-[10px] min-w-0">
            <div
              className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playClick();
                if (onLaunchTaskManager) {
                  onLaunchTaskManager();
                } else {
                  nativeApi.launchTaskManager();
                }
              }}
              title="Mở Task Manager (taskmgr.exe)"
            >
              <span className="w-2 h-2 rounded-full bg-[#64d2ff]" />
              <span className="text-white/60">CPU</span>
              <span className="font-mono text-white font-semibold">{cpuPercent}%</span>
            </div>
            <div
              className="flex items-center gap-1.5 font-medium cursor-pointer hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                sounds.playClick();
                if (onLaunchTaskManager) {
                  onLaunchTaskManager();
                } else {
                  nativeApi.launchTaskManager();
                }
              }}
              title="Mở Task Manager (taskmgr.exe)"
            >
              <span className="w-2 h-2 rounded-full bg-[#30d158]" />
              <span className="text-white/60">RAM</span>
              <span className="font-mono text-white font-semibold">{ramPercent}%</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-[#ff9f0a]" />
              <span className="text-white/60">Pin</span>
              <span className="font-mono text-white font-semibold">{batPercent}%</span>
            </div>
          </div>
        </div>

        {/* Right: iOS 18 Volume Capsule */}
        <div className="flex flex-col justify-between bg-white/[0.07] backdrop-blur-md rounded-[18px] p-2 border border-white/[0.09]">
          <div className="flex items-center justify-between">
            <button
              onClick={(e) => {
                e.stopPropagation();
                sounds.playClick();
                onToggleMute();
              }}
              className="text-white/70 hover:text-white transition-colors p-0.5 cursor-pointer"
              title={volume.isMuted ? 'Bật âm' : 'Tắt tiếng'}
            >
              {volume.isMuted || volume.level === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-white/90" />
              )}
            </button>
            <span className="text-[11px] font-mono font-medium text-white/80">
              {volume.isMuted ? 'Mute' : `${volume.level}%`}
            </span>
          </div>

          {/* Interactive iOS 18 Slider */}
          <div
            className="relative w-full h-4 bg-white/15 rounded-full overflow-hidden cursor-pointer mt-1 touch-none"
            onPointerDown={handleVolumePointerDown}
            onPointerMove={handleVolumePointerMove}
            onPointerUp={handleVolumePointerUp}
            onPointerCancel={handleVolumePointerUp}
          >
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                volume.isMuted ? 'bg-red-500/80' : 'bg-white'
              }`}
              style={{ width: `${volume.isMuted ? 0 : volume.level}%` }}
            />
          </div>

          <button
            type="button"
            className="text-[10px] text-white/45 hover:text-white/80 truncate mt-1 font-medium cursor-pointer transition-colors text-left flex items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              sounds.playClick();
              if (onOpenSoundSettings) {
                onOpenSoundSettings();
              } else {
                nativeApi.openSoundSettings();
              }
            }}
            title="Mở Cài đặt Âm thanh (Sound Settings)"
          >
            <span className="truncate">{bluetoothDevice.name || 'Loa ngoài'}</span>
          </button>
        </div>
      </div>

      {/* 3. BOTTOM STATUS & QUICK ACTION CHIPS */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.08] text-xs">
        {/* Left: Power & Privacy Dots */}
        <div className="flex items-center gap-1.5 text-white/70">
          {battery.isCharging ? (
            <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          ) : (
            <Battery className="w-3.5 h-3.5 text-white/70" />
          )}
          <span className="text-[11px] font-medium text-white/80">
            {battery.level}% {battery.isCharging ? 'Đang sạc' : 'Pin'}
          </span>

          {stats?.mic_in_use && (
            <span className="flex items-center gap-1 ml-1 px-1.5 py-[2px] rounded-full bg-amber-500/20 text-amber-400 text-[9px] font-semibold border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Mic
            </span>
          )}
          {stats?.camera_in_use && (
            <span className="flex items-center gap-1 px-1.5 py-[2px] rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-semibold border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Cam
            </span>
          )}
        </div>

        {/* Right: Quick Action Chips */}
        <div className="flex items-center gap-1.5">
          {/* Quick Focus Pomodoro Pill */}
          {(() => {
            const isPaused =
              !timer.isRunning &&
              timer.remainingSeconds > 0 &&
              timer.remainingSeconds < timer.totalSeconds;
            const isTimerActive = timer.isRunning || isPaused;
            const timerLabel = isTimerActive
              ? formatTimer(timer.remainingSeconds)
              : '25m Focus';

            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.playClick();
                  if (timer.isRunning) {
                    onTimerToggle();
                  } else if (
                    timer.remainingSeconds > 0 &&
                    timer.remainingSeconds < timer.totalSeconds
                  ) {
                    onTimerToggle();
                  } else {
                    onTimerSetSeconds(25 * 60);
                  }
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                  timer.isRunning
                    ? 'bg-amber-500 text-black font-semibold shadow-sm'
                    : isPaused
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-white/10 hover:bg-white/20 text-white/80 border border-transparent'
                }`}
                title={
                  timer.isRunning
                    ? 'Tạm dừng hẹn giờ tập trung'
                    : isPaused
                    ? 'Tiếp tục hẹn giờ tập trung'
                    : 'Bắt đầu hẹn giờ tập trung 25 phút'
                }
              >
                <Timer className="w-3 h-3" />
                <span>{timerLabel}</span>
              </button>
            );
          })()}

          {/* Quick Clipboard Pill */}
          {clipboardText && (
            <button
              type="button"
              onClick={handleCopy}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-400/60 shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 border border-transparent'
              }`}
              title="Sao chép lại văn bản gần nhất"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Đã chép!</span>
                </>
              ) : (
                <>
                  <Clipboard className="w-3 h-3" />
                  <span>Bảng tạm</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
