import React from 'react';

export const WelcomeHudView: React.FC = () => {
  return (
    <div className="flex items-center justify-between w-full h-full px-5 text-white select-none">
      {/* Left: Glowing Apple Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/15 text-white shadow-[0_0_12px_rgba(255,255,255,0.25)]">
          <span className="text-[15px] leading-none mb-0.5"></span>
        </div>
        <div>
          <h4 className="text-[13px] font-semibold text-white tracking-tight leading-none">
            Dynamic Island
          </h4>
          <span className="text-[11px] text-[#86868b] tracking-tight mt-0.5 block">
            Sẵn sàng hoạt động
          </span>
        </div>
      </div>

      {/* Right: Green Online Status */}
      <span className="text-[11px] font-semibold text-[#30d158] bg-[#30d158]/15 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] animate-pulse" />
        Online
      </span>
    </div>
  );
};
