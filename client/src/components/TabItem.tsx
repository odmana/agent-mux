import type { Session } from '../types';

interface TabItemProps {
  session: Session;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export default function TabItem({ session, isActive, onClick, onClose }: TabItemProps) {
  const dirName = session.directory.split('/').pop() || session.directory;

  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-[10px] cursor-pointer transition-all ${
        isActive
          ? 'bg-white/[0.07] border-l-[3px] border-l-blue-400'
          : 'border-l-[3px] border-l-transparent hover:bg-white/[0.04]'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-[13px] font-medium ${isActive ? 'text-[#f4f4f5]' : 'text-white/55'}`}>
          {dirName}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="text-white/10 hover:text-white/40 text-[10px] w-[18px] h-[18px] flex items-center justify-center rounded transition-all"
        >
          ×
        </button>
      </div>
      {session.branch && (
        <div className={`text-[11px] mt-1 ${isActive ? 'text-white/35' : 'text-white/20'}`}>
          {session.branch}
        </div>
      )}
    </div>
  );
}
