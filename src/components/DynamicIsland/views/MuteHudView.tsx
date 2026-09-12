import React from 'react';
import { Bell, BellOff } from 'lucide-react';

interface MuteHudViewProps {
  isMuted: boolean;
}

export const MuteHudView: React.FC<MuteHudViewProps> = ({ isMuted }) => {
  return (
    <div className="flex items-center justify-between w-full h-full px-5 text-white select-none">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center justify-center w-7 h-7 rounded-full ${
            isMuted ? 'bg-[#ff453a]/20 text-[#ff453a]' : 'bg-white/10 text-white'
          }`}
        >
          {isMuted ? <BellOff size={16} /> : <Bell size={16} />}
        </div>
        <div className="text-left">
          <h4 className="text-[13px] font-semibold text-white tracking-tight leading-none">
            {isMuted ? 'Silent Mode' : 'Ringer'}
          </h4>
          <span className="text-[11px] text-[#86868b] tracking-tight mt-0.5 block">
            {isMuted ? 'On' : 'Off'}
          </span>
        </div>
      </div>

      <span
        className={`text-[12px] font-semibold tracking-tight px-2.5 py-0.5 rounded-full ${
          isMuted ? 'bg-[#ff453a]/15 text-[#ff453a]' : 'bg-[#30d158]/15 text-[#30d158]'
        }`}
      >
        {isMuted ? 'Tắt tiếng' : 'Bật âm'}
      </span>
    </div>
  );
};
