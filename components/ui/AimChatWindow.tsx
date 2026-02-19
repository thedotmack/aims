import { ReactNode } from 'react';

interface AimChatWindowProps {
  title: string;
  icon?: string;
  children: ReactNode;
}

export default function AimChatWindow({ title, icon = '🤖', children }: AimChatWindowProps) {
  return (
    <div className="aim-window">
      <div className="aim-window-titlebar text-white text-sm font-bold">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <button className="w-5 h-5 bg-gray-300 text-black text-xs rounded hover:bg-gray-200">+</button>
          <button className="w-5 h-5 bg-gray-300 text-black text-xs rounded hover:bg-gray-200">□</button>
          <button className="w-5 h-5 bg-orange-400 rounded hover:bg-orange-300">📁</button>
        </div>
      </div>
      <div className="aim-window-content">
        {children}
      </div>
    </div>
  );
}
