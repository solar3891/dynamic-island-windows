import React, { useState, useEffect } from 'react';
import type { NativeSystemStats } from '../../../utils/native';
import type { TimerState, MediaTrack } from '../../../types/island';

interface IdleViewProps {
  stats?: NativeSystemStats | null;
  isCapsLockOn?: boolean;
  timer?: TimerState;
  mediaTrack?: MediaTrack;
}

export const IdleView: React.FC<IdleViewProps> = ({
  stats,
  isCapsLockOn = false,
  timer,
  mediaTrack,
}) => {
  const [timeStr, setTimeStr] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  useEffect(() => {
    const t = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex items-center justify-between w-full h-full px-3 text-white select-none">
      {/* Left: Apple glyph + Camera sensor + Privacy Dots */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[13px] text-white/95 font-medium"></span>
        <div className="relative flex items-center justify-center w-2.5 h-2.5 rounded-full bg-[#1c1c1e] border border-white/10">
          <div className="w-1 h-1 rounded-full bg-[#000000]" />
          <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 rounded-full bg-blue-400/60 blur-[0.2px]" />
        </div>

        {/* Live Audio Visualizer Bar if playing */}
        {mediaTrack?.isPlaying && (
          <div className="flex items-end gap-[1.5px] h-2.5 px-0.5" title={mediaTrack.title || 'Playing Audio'}>
            <span className="w-[2px] h-1.5 bg-pink-400 rounded-full animate-pulse" />
            <span className="w-[2px] h-2.5 bg-pink-500 rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-[2px] h-1 bg-pink-400 rounded-full animate-pulse [animation-delay:300ms]" />
          </div>
        )}

        {/* Orange Privacy Dot (Microphone In Use by Windows App) */}
        {stats?.mic_in_use && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_rgba(251,191,36,0.8)]"
            title="Microphone đang được sử dụng"
          />
        )}

        {/* Green Privacy Dot (Webcam / Camera In Use by Windows App) */}
        {stats?.camera_in_use && (
          <span
            className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]"
            title="Camera đang được sử dụng"
          />
        )}

        {/* Caps Lock indicator badge */}
        {isCapsLockOn && (
          <span
            className="px-1 py-[1px] rounded bg-amber-500/20 text-amber-300 text-[8px] font-mono font-bold border border-amber-500/30"
            title="Caps Lock đang bật"
          >
            ⇪
          </span>
        )}
      </div>

      {/* Right: Live Timer countdown OR Hardware / Clock */}
      <div className="flex items-center gap-1.5 shrink-0">
        {timer?.isRunning ? (
          <span className="text-[11px] font-semibold text-amber-400 font-mono tracking-tight flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {formatTimer(timer.remainingSeconds)}
          </span>
        ) : (
          <>
            {/* Live CPU Load % */}
            {stats?.cpu_percent !== undefined && stats.cpu_percent > 0 && (
              <span className="text-[9px] font-mono text-sky-400/80 hidden sm:inline">
                {stats.cpu_percent}%
              </span>
            )}
            {/* Live RAM % */}
            {stats?.ram_percent !== undefined && stats.ram_percent > 0 && (
              <span className="text-[9px] font-mono text-emerald-400/80 hidden sm:inline">
                {stats.ram_percent}%
              </span>
            )}
            <span className="text-[12px] font-semibold text-white/95 font-mono tracking-tight">
              {timeStr}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
