import React from 'react';
import { NavLink } from 'react-router';
import {
  LayoutDashboard,
  Video,
  Calendar,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  Users,
  MessageSquareText,
  Radio,
  Wifi,
  WifiOff
} from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router';
import { UserRole } from '../../types';

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const navigate = useNavigate();
  const isTeacher = role === 'teacher' || role === 'admin';

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    navigate('/');
  };

  return (
    <div className="flex flex-col h-screen w-64 bg-white border-r border-slate-200 shadow-sm fixed left-0 top-0 z-20">
      <div className="p-6 flex items-center space-x-2 border-b border-slate-100">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
          K
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">KIIT Hybrid</h1>
          <p className="text-xs text-slate-500 font-medium">Conference Platform</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Main
        </div>

        {isTeacher ? (
          <>
            <NavItem to="/meetings" icon={Video} label="Meetings" />
            <NavItem to="/schedule" icon={Calendar} label="Schedule" />
            <NavItem to="/recordings" icon={Radio} label="Recordings" />
          </>
        ) : (
          <>
            <NavItem to="/student-home" icon={LayoutDashboard} label="My Classes" />
            <NavItem to="/join" icon={Video} label="Join Class" />
            <NavItem to="/recordings" icon={Radio} label="Recordings" />
          </>
        )}

        <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Intelligence
        </div>
        <NavItem to="/transcripts" icon={MessageSquareText} label="Transcripts" />
        <NavItem to="/mom" icon={FileText} label="MOM & Notes" />


        <div className="px-3 mt-8 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          System
        </div>
        <NavItem to="/settings" icon={Settings} label="Settings" />
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 p-3 rounded-lg flex items-center space-x-3 mb-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs font-medium text-slate-600">System Online</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center space-x-2 text-slate-500 hover:text-red-600 w-full px-2 py-2 rounded-md transition-colors text-sm font-medium"
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label }: { to: string; icon: React.ElementType; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        clsx(
          "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-indigo-50 text-indigo-700 shadow-sm"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        )
      }
    >
      <Icon size={18} strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  );
}
