import React from 'react';
import { useNavigate } from 'react-router';
import {
  Plus,
  Calendar,
  Clock,
  Video,
  Users,
  FileText,
  HardDrive,
  MoreVertical,
  ArrowUpRight,
  Wifi
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { getDashboard, createMeeting } from '../api';

const engagementData: any[] = [];

export function Dashboard() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [user, setUser] = React.useState<any>(null);

  const [dashboardData, setDashboardData] = React.useState<any>(null);

  React.useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    let currentUser = null;
    if (userStr) {
      currentUser = JSON.parse(userStr);
      setUser(currentUser);
    }

    const loadData = async () => {
      try {
        if (currentUser?.id) {
          const data = await getDashboard();
          setDashboardData(data);
          setMeetings(data.upcoming_meetings || []);
        } else {
          console.warn("No user ID found, skipping dashboard data fetch");
          setMeetings([]);
        }
      } catch (e: any) {
        console.error("Failed to load dashboard data", e);
        setError(e.message || "Failed to fetch dashboard data from server");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome back, {user?.name || 'Professor'}</h1>
          <p className="text-slate-500">Here's what's happening in your classes today.</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => navigate('/schedule')}
            className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm"
          >
            <Calendar size={18} className="mr-2 text-slate-500" />
            Schedule Class
          </button>
          <button
            onClick={async () => {
              try {
                const m = await createMeeting({ title: 'Instant Meeting (Direct)', mode: 'online', description: 'Instant Ad-Hoc Session' });
                navigate(`/meeting/${m.id}`);
              } catch (e) {
                console.error('Failed to create instant meeting', e);
              }
            }}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-md shadow-indigo-500/20"
          >
            <Video size={18} className="mr-2" />
            Start Instant Meeting
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Upcoming Classes"
          value={meetings.length.toString()}
          desc="Scheduled"
          icon={Calendar}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          title="Active Students"
          value={dashboardData?.stats?.active_students?.toString() || "0"}
          desc="+0% from last week"
          icon={Users}
          color="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Hours Recorded"
          value={`${dashboardData?.stats?.hours_recorded || 0}h`}
          desc="This month"
          icon={Clock}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          title="Transcripts Ready"
          value={dashboardData?.stats?.transcripts_ready?.toString() || "0"}
          desc="Last 7 days"
          icon={FileText}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-semibold mr-2">Error:</span>
            {error}
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700 font-bold px-2">
            &times;
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">

          {/* Active Session Card (if any) */}
          {(() => {
            const activeMeeting = meetings.find(m => m.status === 'scheduled' || m.status === 'active');
            if (!activeMeeting) return null;

            return (
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-semibold flex items-center">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                      UPCOMING
                    </span>
                    <span className="text-indigo-100 text-sm font-medium">{new Date(activeMeeting.created_at).toLocaleString()}</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{activeMeeting.title}</h2>
                  <p className="text-indigo-100 mb-6 capitalize">{activeMeeting.mode} Mode</p>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => navigate(`/meeting/${activeMeeting.id}`)}
                      className="px-5 py-2.5 bg-white text-indigo-700 font-semibold rounded-lg shadow-lg hover:bg-indigo-50 transition-colors"
                    >
                      Start Session
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/meeting/${activeMeeting.id}`);
                        alert("Link copied to clipboard!");
                      }}
                      className="px-5 py-2.5 bg-white/20 backdrop-blur-md text-white font-semibold rounded-lg shadow-lg hover:bg-white/30 transition-colors border border-white/30"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Recent Meetings List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Recent Sessions</h3>
              <button className="text-sm text-indigo-600 font-medium hover:underline">View All</button>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading schedule...</div>
              ) : meetings.length === 0 ? (
                <div className="p-8 text-center text-slate-500">No scheduled sessions found.</div>
              ) : (
                meetings.map((m: any) => (
                  <MeetingRow
                    key={m.id}
                    title={m.title}
                    date={new Date(m.created_at).toLocaleString()}
                    status={m.status}
                    type={m.mode}
                    onClick={() => navigate(`/meeting/${m.id}`)}
                  />
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right Sidebar Widgets */}
        <div className="space-y-6">
          {/* Engagement Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4">Student Engagement</h3>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={engagementData}>
                  <defs>
                    <linearGradient id="colorInteraction" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <YAxis hide />
                  <Tooltip />
                  <Area type="monotone" dataKey="interaction" stroke="#4f46e5" strokeWidth={2} fillOpacity={1} fill="url(#colorInteraction)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Insights / Notifications */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              AI Insights
            </h3>
            <div className="space-y-4">
              {dashboardData?.insights?.length ? (
                dashboardData.insights.map((insight: any, i: number) => (
                  <InsightItem
                    key={i}
                    text={insight.text}
                    time={insight.time}
                    type={insight.type}
                  />
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">
                  Waiting for class insights...
                </div>
              )}
            </div>
          </div>

          {/* Offline Storage Status */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Local Storage</h4>
              <HardDrive size={14} className="text-slate-400" />
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
              <div className="bg-indigo-500 h-2 rounded-full w-[65%]"></div>
            </div>
            <p className="text-xs text-slate-500 flex justify-between">
              <span>65% Used</span>
              <span>120GB Free</span>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, desc, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">{desc}</span>
      </div>
      <h3 className="text-2xl font-bold text-slate-800 mb-1">{value}</h3>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
    </div>
  );
}

function MeetingRow({ title, date, status, type, onClick }: any) {
  return (
    <div onClick={onClick} className="p-4 hover:bg-slate-50 flex items-center justify-between group transition-colors cursor-pointer">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
          <Video size={18} />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
          <p className="text-xs text-slate-500">{date}</p>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-right hidden sm:block">
          <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${status === 'Ready' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
            {status}
          </span>
          <span className="ml-2 inline-block px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
            {type}
          </span>
        </div>
        <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
          <ArrowUpRight size={18} />
        </button>
      </div>
    </div>
  );
}

function InsightItem({ text, time, type }: any) {
  return (
    <div className="flex items-start space-x-3">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${type === 'success' ? 'bg-emerald-500' : type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
        }`}></div>
      <div>
        <p className="text-sm text-slate-700 leading-snug">{text}</p>
        <span className="text-[10px] text-slate-400 mt-1 block">{time}</span>
      </div>
    </div>
  );
}
