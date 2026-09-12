import React from 'react';

interface CapsLockHudViewProps {
  isOn: boolean;
}

export const CapsLockHudView: React.FC<CapsLockHudViewProps> = ({ isOn }) => {
  return (
    <div className="flex items-center justify-between w-full h-full px-5 text-white select-none">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white font-bold text-[14px]">
          ⇪
        </div>
        <div className="text-left">
          <h4 className="text-[13px] font-semibold text-white tracking-tight leading-none">
            Caps Lock
          </h4>
          <span className="text-[11px] text-[#86868b] tracking-tight mt-0.5 block">
            {isOn ? 'On' : 'Off'}
          </span>
        </div>
      </div>

      <span
        className={`text-[12px] font-semibold tracking-tight px-2.5 py-0.5 rounded-full ${
          isOn ? 'bg-white/20 text-white' : 'bg-white/10 text-[#86868b]'
        }`}
      >
        {isOn ? 'BẬT' : 'TẮT'}
      </span>
    </div>
  );
};
