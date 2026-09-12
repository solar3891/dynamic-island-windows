import React, { useRef } from 'react';
import type { MediaTrack } from '../../../types/island';

interface CompactMediaViewProps {
  track: MediaTrack;
  onFocusApp?: () => void;
  onExpand?: () => void;
}

export const CompactMediaView: React.FC<CompactMediaViewProps> = ({
  track,
  onFocusApp,
  onExpand,
}) => {
  const songTitle = track.title || 'Đang phát nhạc';
  const artistName = track.artist || '';
  const marqueeText = artistName ? `${songTitle}   •   ${artistName}` : songTitle;

  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const handlePointerDown = () => {
    isLongPressRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onExpand?.();
    }, 360);
  };

  const handlePointerUp = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handlePointerCancel = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleQuickTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (onFocusApp) {
      onFocusApp();
    } else {
      onExpand?.();
    }
  };

  return (
    <div
      className="flex items-center justify-between w-full h-full px-2.5 select-none overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onExpand?.();
      }}
    >
      {/* Leading: Squircle Album Thumbnail (Exact Apple HIG: 24x24, 7px radius) */}
      <div
        onClick={handleQuickTap}
        className="shrink-0 w-[24px] h-[24px] rounded-[7px] overflow-hidden shadow-sm bg-[#1a1a24] flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
        title="Nhấn để mở ứng dụng phát nhạc • Nhấn giữ hoặc đúp chuột để bung rộng"
      >
        {track.albumArt ? (
          <img
            src={track.albumArt}
            alt={track.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#fa2d48] to-[#d62039] flex items-center justify-center text-white">
            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
      </div>

      {/* Middle: Apple Dynamic Island Marquee Title Ticker */}
      <div
        onClick={handleQuickTap}
        className="flex-1 min-w-0 mx-2 overflow-hidden h-full flex items-center mask-linear-fade cursor-pointer"
        title="Nhấn để mở ứng dụng phát nhạc • Nhấn giữ hoặc đúp chuột để bung rộng"
      >
        <div className="animate-marquee-smooth flex items-center text-[11px] font-semibold text-white/90 tracking-tight font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif]">
          <span className="shrink-0 pr-6">{marqueeText}</span>
          <span className="shrink-0 pr-6" aria-hidden="true">{marqueeText}</span>
        </div>
      </div>

      {/* Trailing: Apple Equalizer Waveform */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onExpand?.();
        }}
        className="flex items-end gap-[2px] h-[15px] px-0.5 shrink-0 cursor-pointer hover:opacity-80"
        title="Bấm để bung rộng trình điều khiển"
      >
        <span
          className="w-[2.2px] bg-[#fa2d48] rounded-full wave-1"
          style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
        />
        <span
          className="w-[2.2px] bg-[#fa2d48] rounded-full wave-2"
          style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
        />
        <span
          className="w-[2.2px] bg-[#fa2d48] rounded-full wave-3"
          style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
        />
      </div>
    </div>
  );
};
