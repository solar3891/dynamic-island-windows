import React from 'react';
import type { BluetoothDevice } from '../../../types/island';

interface BluetoothHudViewProps {
  device: BluetoothDevice;
}

export const BluetoothHudView: React.FC<BluetoothHudViewProps> = ({ device }) => {
  const isSpeaker = device.name.toLowerCase().includes('speaker') || device.name.toLowerCase().includes('realtek');
  const isDisplay = device.name.toLowerCase().includes('hdmi') || device.name.toLowerCase().includes('nvidia') || device.name.toLowerCase().includes('display');

  const hasBattery = device.batteryLeft !== undefined || device.batteryRight !== undefined || device.batteryCase !== undefined;

  return (
    <div className="flex items-center justify-between w-full h-full px-5 text-white select-none">
      {/* Device Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white">
          {isSpeaker ? (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          ) : isDisplay ? (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 3a9 9 0 0 0-9 9v7c0 1.1.9 2 2 2h4v-8H5v-1a7 7 0 0 1 14 0v1h-4v8h4c1.1 0 2-.9 2-2v-7a9 9 0 0 0-9-9z" />
            </svg>
          )}
        </div>
        <div className="max-w-[170px] truncate">
          <h4 className="text-[13px] font-semibold text-white tracking-tight leading-none truncate">
            {device.name}
          </h4>
          <span className="text-[11px] text-[#86868b] tracking-tight mt-0.5 block">
            Thiết bị âm thanh
          </span>
        </div>
      </div>

      {/* Pods & Case Battery Badges or Connected Pill */}
      {hasBattery ? (
        <div className="flex items-center gap-2 text-[11px] font-mono">
          {device.batteryLeft !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[#86868b] text-[9px]">L</span>
              <span className="font-semibold text-[#30d158]">{device.batteryLeft}%</span>
            </div>
          )}
          {device.batteryRight !== undefined && (
            <div className="flex items-center gap-1">
              <span className="text-[#86868b] text-[9px]">R</span>
              <span className="font-semibold text-[#30d158]">{device.batteryRight}%</span>
            </div>
          )}
          {device.batteryCase !== undefined && (
            <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-full">
              <span className="text-[#86868b] text-[9px]">Case</span>
              <span className="font-semibold text-white">{device.batteryCase}%</span>
            </div>
          )}
        </div>
      ) : (
        <span className="text-[11px] font-semibold text-[#30d158] bg-[#30d158]/15 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#30d158] animate-pulse" />
          Đã kết nối
        </span>
      )}
    </div>
  );
};
