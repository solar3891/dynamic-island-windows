import React from 'react';
import { Sun } from 'lucide-react';
import { sounds } from '../../../utils/audio';

interface BrightnessHudViewProps {
  level: number; // 0 - 100
  onBrightnessChange?: (val: number) => void;
}

export const BrightnessHudView: React.FC<BrightnessHudViewProps> = ({
  level,
  onBrightnessChange,
}) => {
  return (
    <div className="flex items-center justify-between w-full h-full px-4 select-none">
      {/* Sun Icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          sounds.playClick();
          if (onBrightnessChange) {
            onBrightnessChange(level >= 100 ? 50 : 100);
          }
        }}
        className="shrink-0 mr-3 hover:opacity-80 transition-opacity cursor-pointer p-0.5"
        title="Độ sáng màn hình"
      >
        <Sun className="w-4 h-4 text-amber-300" />
      </button>

      {/* Slider */}
      <div
        className="flex-1 h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer relative"
        onClick={(e) => {
          e.stopPropagation();
          sounds.playClick();
          if (!onBrightnessChange) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          onBrightnessChange(Math.round(ratio * 100));
        }}
      >
        <div
          className="h-full bg-amber-300 rounded-full transition-all duration-100"
          style={{ width: `${level}%` }}
        />
      </div>

      {/* Percentage */}
      <div className="shrink-0 ml-3 text-xs font-mono font-medium text-white/80 w-8 text-right">
        {level}%
      </div>
    </div>
  );
};
