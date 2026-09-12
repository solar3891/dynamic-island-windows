import React from 'react';
import { motion } from 'framer-motion';
import { Timer as TimerIcon } from 'lucide-react';
import type { MediaTrack, TimerState } from '../../../types/island';

interface SplitIslandViewProps {
  mediaTrack: MediaTrack;
  timer: TimerState;
  onExpandMedia: () => void;
  onExpandTimer: () => void;
  onFocusApp?: () => void;
}

export const SplitIslandView: React.FC<SplitIslandViewProps> = ({
  mediaTrack,
  timer,
  onExpandMedia,
  onExpandTimer,
  onFocusApp,
}) => {
  const songTitle = mediaTrack.title || 'Đang phát nhạc';
  const artistName = mediaTrack.artist || '';
  const marqueeText = artistName ? `${songTitle} • ${artistName}` : songTitle;

  const mins = Math.floor(timer.remainingSeconds / 60);
  const secs = timer.remainingSeconds % 60;
  const timeString = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div className="flex items-center justify-between w-full h-full select-none">
      {/* Leading Bubble: Media Player Pill (~176px) */}
      <motion.div
        whileHover={{ scale: 1.025 }}
        whileTap={{ scale: 0.97 }}
        onClick={(e) => {
          e.stopPropagation();
          onExpandMedia();
        }}
        className="flex items-center justify-between h-[32px] px-2 bg-black rounded-full apple-pill-shadow cursor-pointer overflow-hidden border border-white/[0.08] flex-1 max-w-[176px] mr-2"
        title="Bấm để mở rộng Trung tâm điều khiển (nhạc & hẹn giờ), bấm vào ảnh để chuyển ứng dụng"
      >
        {/* Album Artwork with Quick Focus Action */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (onFocusApp) {
              onFocusApp();
            } else {
              onExpandMedia();
            }
          }}
          className="shrink-0 w-[22px] h-[22px] rounded-[6px] overflow-hidden shadow-sm bg-[#1a1a24] flex items-center justify-center hover:opacity-85 transition-opacity"
          title="Chuyển nhanh tới cửa sổ ứng dụng phát nhạc"
        >
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
            <div className="w-full h-full bg-gradient-to-br from-[#fa2d48] to-[#d62039] flex items-center justify-center text-white">
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
        </div>

        {/* Marquee Title */}
        <div className="flex-1 min-w-0 mx-1.5 overflow-hidden h-full flex items-center mask-linear-fade">
          <div className="animate-marquee-smooth flex items-center text-[10.5px] font-semibold text-white/90 tracking-tight font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Display',sans-serif]">
            <span className="shrink-0 pr-4">{marqueeText}</span>
            <span className="shrink-0 pr-4" aria-hidden="true">
              {marqueeText}
            </span>
          </div>
        </div>

        {/* Dynamic Equalizer Waveform */}
        <div className="flex items-end gap-[1.8px] h-[13px] px-0.5 shrink-0">
          <span
            className="w-[2px] bg-[#fa2d48] rounded-full wave-1"
            style={{ animationPlayState: mediaTrack.isPlaying ? 'running' : 'paused' }}
          />
          <span
            className="w-[2px] bg-[#fa2d48] rounded-full wave-2"
            style={{ animationPlayState: mediaTrack.isPlaying ? 'running' : 'paused' }}
          />
          <span
            className="w-[2px] bg-[#fa2d48] rounded-full wave-3"
            style={{ animationPlayState: mediaTrack.isPlaying ? 'running' : 'paused' }}
          />
        </div>
      </motion.div>

      {/* Trailing Bubble: Live Countdown Timer Pill (~76px) */}
      <motion.div
        whileHover={{ scale: 1.035 }}
        whileTap={{ scale: 0.96 }}
        onClick={(e) => {
          e.stopPropagation();
          onExpandTimer();
        }}
        className="flex items-center justify-center gap-1.5 h-[32px] px-2.5 bg-black rounded-full apple-pill-shadow cursor-pointer border border-[#ff9f0a]/30 shrink-0 min-w-[74px]"
        title="Bấm để mở rộng Trung tâm điều khiển (nhạc & hẹn giờ)"
      >
        <TimerIcon className="w-3.5 h-3.5 text-[#ff9f0a] animate-pulse" />
        <span className="text-[11px] font-bold text-[#ff9f0a] font-mono tracking-tight tabular-nums">
          {timeString}
        </span>
      </motion.div>
    </div>
  );
};
