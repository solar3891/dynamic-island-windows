import React from 'react';
import { Timer, Pause, Play, RotateCcw } from 'lucide-react';
import type { TimerState } from '../../../types/island';
import { sounds } from '../../../utils/audio';

interface TimerViewProps {
  timer: TimerState;
  isExpanded: boolean;
  onToggleTimer: () => void;
  onResetTimer: () => void;
}

export const TimerView: React.FC<TimerViewProps> = ({
  timer,
  isExpanded,
  onToggleTimer,
  onResetTimer,
}) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!isExpanded) {
    return (
      <div className="flex items-center justify-between w-full h-full px-3 text-white select-none">
        {/* Leading: Timer Icon with orange glow */}
        <div className="flex items-center space-x-1.5">
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/20 text-amber-400">
            <Timer className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Trailing: Countdown */}
        <div className="font-mono text-xs font-semibold text-amber-400">
          {formatTime(timer.remainingSeconds)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between w-full h-full p-4 text-white select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-400">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white/90">{timer.label}</h4>
            <span className="text-[10px] text-white/50">Hẹn giờ hệ thống</span>
          </div>
        </div>

        {/* Digital display */}
        <div className="font-mono text-2xl font-bold tracking-wider text-amber-400">
          {formatTime(timer.remainingSeconds)}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end space-x-3 pt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.playClick();
            onResetTimer();
          }}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all cursor-pointer"
          title="Đặt lại"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.playClick();
            onToggleTimer();
          }}
          className="flex items-center space-x-1 px-4 py-1.5 rounded-full bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400 transition-all cursor-pointer"
        >
          {timer.isRunning ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Tạm dừng</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Tiếp tục</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
