import React from 'react';
import type { BatteryState } from '../../../types/island';

interface BatteryHudViewProps {
  battery: BatteryState;
}

export const BatteryHudView: React.FC<BatteryHudViewProps> = ({ battery }) => {
  return (
    <div className="flex items-center justify-between w-full h-full px-4 select-none">
      {/* Left: Charging label with lightning glyph */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-[#30d158]/20 text-[#30d158]">
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M7 2v11h3v9l7-12h-4l4-8z" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-white tracking-tight">
          {battery.isCharging ? 'Charging' : 'Battery'}
        </span>
      </div>

      {/* Right: Authentic iOS Battery Pill + Percentage */}
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-semibold text-[#30d158] font-mono tracking-tight">
          {battery.level}%
        </span>
        <div className="relative w-6 h-3.5 rounded-[4px] border border-[#30d158]/80 p-[1.5px] flex items-center">
          <div
            className="h-full rounded-[2px] bg-[#30d158] transition-all duration-300"
            style={{ width: `${battery.level}%` }}
          />
          <div className="absolute -right-1 top-1 w-0.5 h-1.5 rounded-r-[1px] bg-[#30d158]/80" />
        </div>
      </div>
    </div>
  );
};
