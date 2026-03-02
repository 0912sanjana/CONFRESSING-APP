import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Calendar, Plus, Clock } from 'lucide-react';
import { getDashboard } from '../api';

export function Meetings() {
    const navigate = useNavigate();
    const [meetings, setMeetings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeetings = async () => {
            const userStr = localStorage.getItem('currentUser');
            if (userStr) {
                try {
                    const data = await getDashboard();
                    setMeetings(data.upcoming_meetings || []);
                } catch (e) {
                    console.error("Failed to fetch meetings", e);
                }
            }
            setLoading(false);
        };
        fetchMeetings();
    }, []);


    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Meetings</h1>
                    <p className="text-slate-500">Manage your scheduled sessions and create new ones.</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => navigate('/schedule')}
                        className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm"
                    >
                        <Calendar size={18} className="mr-2 text-indigo-600" />
                        Schedule Class
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <Calendar size={18} className="mr-2 text-indigo-500" />
                        Upcoming Scheduled Meetings
                    </h3>
                </div>
                <div className="divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading your schedule...</div>
                    ) : meetings.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Calendar size={24} className="text-slate-400" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">No Upcoming Meetings</h3>
                            <p className="text-sm text-slate-500 mb-6 max-w-md">You don't have any scheduled sessions coming up. Schedule a new class to inform your students.</p>
                            <button
                                onClick={() => navigate('/schedule')}
                                className="flex items-center px-5 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-semibold text-sm transition-colors"
                            >
                                <Plus size={18} className="mr-2" />
                                Schedule First Class
                            </button>
                        </div>
                    ) : (
                        meetings.map((m) => (
                            <div key={m.id} className="p-5 hover:bg-slate-50 flex items-center justify-between group transition-colors">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-12 rounded-xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-700 border border-indigo-100 shadow-sm">
                                        <span className="text-xs font-bold leading-none">{new Date(m.created_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                                        <span className="text-lg font-black leading-none mt-0.5">{new Date(m.created_at).getDate()}</span>
                                    </div>
                                    <div>
                                        <h4 className="text-base font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{m.title}</h4>
                                        <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1.5">
                                            <span className="flex items-center"><Clock size={12} className="mr-1" /> {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="flex items-center bg-slate-100 px-2 py-0.5 rounded uppercase font-bold text-[10px] tracking-wider text-slate-600">
                                                {m.mode}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3">
                                    <button
                                        onClick={() => navigate(`/meeting/${m.id}`)}
                                        className="px-4 py-2 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-600 font-semibold rounded-lg text-sm transition-colors shadow-sm"
                                    >
                                        Start Session
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
