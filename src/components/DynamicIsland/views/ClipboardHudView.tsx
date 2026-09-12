import React from 'react';
import { ClipboardCheck } from 'lucide-react';

interface ClipboardHudViewProps {
  text: string;
}

export const ClipboardHudView: React.FC<ClipboardHudViewProps> = ({ text }) => {
  const preview = text.trim().replace(/\s+/g, ' ');
  const display = preview.length > 28 ? `${preview.slice(0, 28)}...` : preview;

  return (
    <div className="flex items-center justify-between w-full h-full px-4 text-white select-none">
      {/* Left: Clipboard Icon & Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/15 text-sky-400 shrink-0 shadow-[0_0_10px_rgba(56,189,248,0.25)]">
          <ClipboardCheck className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0 flex-1 pr-2">
          <span className="text-[10px] text-white/50 block font-medium uppercase tracking-wider leading-none">
            Đã Sao Chép
          </span>
          <span className="text-[12px] font-medium text-white truncate block mt-0.5">
            "{display}"
          </span>
        </div>
      </div>

      {/* Right: Copied Pill */}
      <div className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-semibold shrink-0">
        Copied
      </div>
    </div>
  );
};
