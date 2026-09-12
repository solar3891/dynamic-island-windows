import React, { useState, useRef } from 'react';
import type { MediaTrack } from '../../../types/island';
import { sounds } from '../../../utils/audio';

interface ExpandedMediaViewProps {
  track: MediaTrack;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (seconds: number) => void;
  onOpenSoundSettings?: () => void;
  onSwitchToStats?: () => void;
}

export const ExpandedMediaView: React.FC<ExpandedMediaViewProps> = ({
  track,
  onTogglePlay,
  onNext,
  onPrevious,
  onSeek,
  onOpenSoundSettings,
  onSwitchToStats,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPos, setDragPos] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    const sValid = Math.max(0, Math.floor(secs));
    const m = Math.floor(sValid / 60);
    const s = Math.floor(sValid % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentPos = isDragging ? dragPos : track.position;
  const progressPercent = track.duration > 0
    ? Math.min(100, Math.max(0, (currentPos / track.duration) * 100))
    : 0;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!barRef.current || track.duration <= 0) return;
    barRef.current.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newPos = ratio * track.duration;
    setDragPos(newPos);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !barRef.current || track.duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const newPos = ratio * track.duration;
    setDragPos(newPos);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    if (barRef.current) {
      try {
        barRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }
    setIsDragging(false);
    onSeek(dragPos);
  };

  return (
    <div className="relative flex flex-col justify-between w-full h-full px-5 py-4 text-white select-none overflow-hidden">
      {/* Top Header: Album Art, Song Meta, Apple Music Waveform */}
      <div className="flex items-center gap-3.5">
        {/* Album Artwork Squircle */}
        <div className="relative shrink-0 w-[54px] h-[54px] rounded-[13px] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.6)] bg-[#1a1a24] flex items-center justify-center">
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
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Title & Artist (Apple Typography) */}
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-[15px] font-semibold text-white tracking-[-0.015em] truncate leading-snug">
            {track.title || 'Đang chờ phát nhạc...'}
          </h3>
          <p className="text-[13px] font-normal text-[#86868b] tracking-[-0.01em] truncate mt-0.5">
            {track.artist || 'Windows Media'}
          </p>
        </div>

        {/* Apple Equalizer Waveform (True iOS 4-Bar Spec) */}
        <div className="flex items-end gap-[2px] h-[18px] px-1 shrink-0">
          <span
            className="w-[2.5px] bg-[#fa2d48] rounded-full wave-1"
            style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
          />
          <span
            className="w-[2.5px] bg-[#fa2d48] rounded-full wave-2"
            style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
          />
          <span
            className="w-[2.5px] bg-[#fa2d48] rounded-full wave-3"
            style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
          />
          <span
            className="w-[2.5px] bg-[#fa2d48] rounded-full wave-4"
            style={{ animationPlayState: track.isPlaying ? 'running' : 'paused' }}
          />
        </div>
      </div>

      {/* Middle: Apple Scrubber Bar & Tabular Timestamps */}
      <div className="my-auto pt-1" onClick={(e) => e.stopPropagation()}>
        <div
          ref={barRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="group relative w-full py-2.5 -my-2 cursor-pointer flex items-center touch-none select-none"
        >
          {/* Track background */}
          <div className="relative w-full h-[4px] group-hover:h-[6px] bg-white/20 rounded-full transition-all overflow-visible">
            {/* Filled progress */}
            <div
              className="h-full bg-white rounded-full transition-[width] duration-75"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Apple Scrubber Thumb Knob - Exactly Centered on Bar Axis */}
            <div
              className={`absolute w-3.5 h-3.5 bg-white rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.6)] transition-opacity duration-100 pointer-events-none ${
                isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              style={{
                top: '50%',
                left: `${progressPercent}%`,
                transform: `translate(-50%, -50%) scale(${isDragging ? 1.25 : 1})`,
              }}
            />
          </div>
        </div>

        <div className="flex justify-between text-[11px] font-medium text-[#86868b] mt-0.5 font-mono tracking-tight select-none">
          <span>{formatTime(currentPos)}</span>
          <span>-{formatTime(Math.max(0, track.duration - currentPos))}</span>
        </div>
      </div>

      {/* Bottom Controls: Authentic iOS AirPlay & Pure White Icons */}
      <div className="flex items-center justify-between px-1 pb-0.5">
        {/* Apple AirPlay / Sound Settings Icon */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.playClick();
            onOpenSoundSettings?.();
          }}
          className="text-[#86868b] hover:text-white transition-colors cursor-pointer p-1 active:scale-95 hover:bg-white/10 rounded-lg"
          title="Cài đặt Âm thanh & Cast"
        >
          <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
            <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L6.4 16.2A6.978 6.978 0 0 1 5 12c0-3.86 3.14-7 7-7s7 3.14 7 7c0 1.55-.51 2.99-1.4 4.2l1.43 1.41C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9zm0 4c-2.76 0-5 2.24-5 5 0 1.15.39 2.22 1.05 3.07l1.43-1.43A2.982 2.982 0 0 1 9 12c0-1.66 1.34-3 3-3s3 1.34 3 3c0 .69-.23 1.33-.63 1.84l1.43 1.43C16.46 14.42 17 13.27 17 12c0-2.76-2.24-5-5-5zm0 8l-4 5h8l-4-5z" />
          </svg>
        </button>

        {/* Playback Controls (Genuine Apple Style: Clean White Glyphs without circular badge) */}
        <div className="flex items-center gap-7">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
            className="text-white hover:opacity-80 active:scale-90 transition-all p-1 cursor-pointer"
            title="Previous"
          >
            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
            className="text-white hover:opacity-80 active:scale-90 transition-all p-1 cursor-pointer"
            title={track.isPlaying ? 'Pause' : 'Play'}
          >
            {track.isPlaying ? (
              <svg className="w-[26px] h-[26px] fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-[26px] h-[26px] fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
            className="text-white hover:opacity-80 active:scale-90 transition-all p-1 cursor-pointer"
            title="Next"
          >
            <svg className="w-[20px] h-[20px] fill-current" viewBox="0 0 24 24">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Right toggle button: Switch to Control Center / Stats */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.playClick();
            onSwitchToStats?.();
          }}
          className="text-[#86868b] hover:text-white transition-colors cursor-pointer p-1 active:scale-95 hover:bg-white/10 rounded-lg flex items-center justify-center"
          title="Mở Trung tâm điều khiển (CPU, RAM, Volume, Timer...)"
        >
          <svg className="w-[18px] h-[18px] fill-current" viewBox="0 0 24 24">
            <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
