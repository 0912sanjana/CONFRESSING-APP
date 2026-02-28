import React, { useState } from 'react';
import { Search, Bell, Menu, X, HelpCircle, User } from 'lucide-react';
import { UserRole } from '../../types';

interface HeaderProps {
  toggleSidebar?: () => void;
  role: UserRole;
  userName: string;
}

export function Header({ toggleSidebar, role, userName }: HeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="h-16 flex items-center justify-between px-6 border-b border-slate-200 bg-white sticky top-0 z-10 w-full">
      <div className="flex items-center space-x-4">
        <button onClick={toggleSidebar} className="md:hidden p-2 hover:bg-slate-100 rounded-lg">
          <Menu size={20} className="text-slate-600" />
        </button>
        <div className="relative w-64 hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search meetings, transcripts..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative"
          >
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
              <h3 className="font-semibold text-sm mb-3 text-slate-800">Notifications</h3>
              <div className="space-y-3">
                <NotificationItem title="New MOM Generated" desc="Meeting: CS-101 Lecture 5" time="2m ago" unread />
                <NotificationItem title="Class Starting Soon" desc="Data Structures - Room 302" time="15m ago" unread />
                <NotificationItem title="System Update" desc="Offline mode sync completed" time="1h ago" />
              </div>
              <button className="w-full mt-3 text-center text-xs text-indigo-600 font-medium hover:underline">View All</button>
            </div>
          )}
        </div>

        <button className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors hidden sm:block">
          <HelpCircle size={20} />
        </button>

        <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold text-slate-800">{userName}</p>
            <p className="text-xs text-slate-500 capitalize">{role}</p>
          </div>
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium shadow-md cursor-pointer hover:shadow-lg transition-shadow">
            {userName.charAt(0)}
          </div>
        </div>
      </div>
    </header>
  );
}

function NotificationItem({ title, desc, time, unread }: { title: string; desc: string; time: string; unread?: boolean }) {
  return (
    <div className={`flex items-start space-x-3 p-2 rounded-lg ${unread ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
      <div className={`w-2 h-2 mt-1.5 rounded-full ${unread ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
      <div>
        <h4 className="text-xs font-semibold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500 line-clamp-1">{desc}</p>
        <span className="text-[10px] text-slate-400 mt-1 block">{time}</span>
      </div>
    </div>
  );
}
