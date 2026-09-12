import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, CheckCircle2, FolderDown } from 'lucide-react';
import { nativeApi } from '../../../utils/native';

export interface DownloadHudProps {
  filename: string;
  speedKbps?: number;
  downloadedBytes?: number;
  isComplete: boolean;
  filePath?: string;
  onClick?: () => void;
}

export const DownloadHudView: React.FC<DownloadHudProps> = ({
  filename,
  speedKbps = 0,
  downloadedBytes = 0,
  isComplete,
  filePath,
  onClick,
}) => {
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  };

  const formatSpeed = (kbps: number) => {
    if (!kbps || kbps <= 0) return 'Đang tải...';
    if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
    return `${Math.round(kbps)} KB/s`;
  };

  const cleanFilename = filename.replace(/\.(crdownload|part|opdownload)$/i, '');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick();
    } else if (filePath) {
      nativeApi.showInFolder(filePath);
    } else {
      nativeApi.showInFolder('');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center justify-between w-full h-full px-3 select-none cursor-pointer overflow-hidden"
      title="Bấm để mở tệp hoặc thư mục Downloads"
    >
      {/* Leading: Icon Indicator */}
      <div className="shrink-0 flex items-center justify-center mr-2.5">
        {isComplete ? (
          <motion.div
            initial={{ scale: 0.5, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            className="w-6 h-6 rounded-full bg-[#30d158]/20 flex items-center justify-center text-[#30d158] border border-[#30d158]/40 shadow-[0_0_10px_rgba(48,209,88,0.4)]"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </motion.div>
        ) : (
          <div className="relative w-6 h-6 rounded-full bg-cyan-500/15 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
            <motion.div
              animate={{ y: [0, 2, 0] }}
              transition={{ repeat: Infinity, duration: 1, ease: 'easeInOut' }}
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </motion.div>
          </div>
        )}
      </div>

      {/* Center: Filename and Status */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="text-[11px] font-semibold text-white/95 truncate leading-tight tracking-tight">
          {cleanFilename || 'Đang tải tệp...'}
        </div>
        <div className="text-[9.5px] font-medium text-white/60 truncate flex items-center gap-1.5 leading-tight mt-0.5">
          {isComplete ? (
            <span className="text-[#30d158] font-semibold flex items-center gap-1">
              Đã tải xong • Bấm để mở
            </span>
          ) : (
            <>
              <span className="text-cyan-400 font-mono font-semibold">
                {formatSpeed(speedKbps)}
              </span>
              {downloadedBytes > 0 && (
                <>
                  <span className="text-white/30">•</span>
                  <span className="font-mono">{formatBytes(downloadedBytes)}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Trailing: Open action icon */}
      <div className="shrink-0 ml-2 text-white/40 hover:text-white/80 transition-colors">
        <FolderDown className="w-3.5 h-3.5" />
      </div>
    </div>
  );
};
