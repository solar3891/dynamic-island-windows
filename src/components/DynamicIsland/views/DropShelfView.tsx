import React, { useState } from 'react';
import { UploadCloud, File, Check, X } from 'lucide-react';
import { nativeApi } from '../../../utils/native';
import { sounds } from '../../../utils/audio';

export interface DroppedItem {
  id: string;
  name: string;
  size: string;
  path: string;
}

export interface DropShelfViewProps {
  items?: DroppedItem[];
  onRemoveItem?: (id: string) => void;
  onOpenFile?: (path: string) => void;
  onDropFiles?: (files: File[]) => void;
}

export const DropShelfView: React.FC<DropShelfViewProps> = ({
  items: propItems,
  onRemoveItem,
  onOpenFile,
  onDropFiles,
}) => {
  const [internalItems, setInternalItems] = useState<DroppedItem[]>([]);
  const items = propItems ?? internalItems;
  const [isDragOver, setIsDragOver] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div
      className={`relative flex flex-col justify-between w-full h-full p-4 text-white select-none border-2 border-dashed rounded-[32px] transition-colors duration-200 ${
        isDragOver
          ? 'border-cyan-400 bg-cyan-950/20'
          : 'border-white/20 bg-transparent'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files || []);
        if (files.length > 0) {
          if (onDropFiles) {
            onDropFiles(files);
          } else {
            const newItems: DroppedItem[] = files.map((f, idx) => {
              const filePath = (f as any).path || (f as any).webkitRelativePath || f.name;
              return {
                id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
                name: f.name,
                path: filePath,
                size: formatFileSize(f.size),
              };
            });
            setInternalItems((prev) => [...newItems, ...prev]);
          }
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400">
            <UploadCloud className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-white">Dropover Shelf</h4>
            <p className="text-[10px] text-white/50">Kéo & thả tệp để giữ tạm hoặc chia sẻ</p>
          </div>
        </div>

        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70">
          {items.length} tệp
        </span>
      </div>

      {/* Dropped items list */}
      <div className="flex space-x-2 my-2 overflow-x-auto py-1 scrollbar-none">
        {items.length === 0 ? (
          <div className="flex items-center justify-center w-full py-2 text-[11px] text-white/40 italic">
            <span>Chưa có tệp nào trên kệ</span>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                sounds.playClick();
                if (onOpenFile) {
                  onOpenFile(item.path);
                } else {
                  nativeApi.openFilePath(item.path);
                }
              }}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/15 active:scale-[0.98] px-2.5 py-1.5 rounded-xl border border-white/10 shrink-0 text-xs cursor-pointer transition-all duration-150"
              title={item.path ? `Mở file: ${item.path}` : item.name}
            >
              <File className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="flex flex-col max-w-[120px]">
                <span className="truncate text-white/90 font-medium">{item.name}</span>
                <span className="text-[9px] text-white/40">{item.size}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  sounds.playClick();
                  if (onRemoveItem) {
                    onRemoveItem(item.id);
                  } else {
                    setInternalItems((prev) => prev.filter((i) => i.id !== item.id));
                  }
                }}
                className="text-white/40 hover:text-white hover:bg-white/10 p-0.5 rounded ml-1 transition-colors cursor-pointer"
                title="Xóa khỏi kệ"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Bottom status */}
      <div className="flex items-center justify-between text-[10px] text-white/40 pt-1">
        <span>Sẵn sàng kéo vào ứng dụng khác bất cứ lúc nào</span>
        <div className="flex items-center space-x-1 text-cyan-400">
          <Check className="w-3 h-3" />
          <span>Active</span>
        </div>
      </div>
    </div>
  );
};
