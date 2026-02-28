import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Search, FileText, Download, Eye } from 'lucide-react';
import { getMeetings } from '../api';

export function Transcripts() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [transcripts, setTranscripts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTranscripts = async () => {
            try {
                const allMeetings = await getMeetings();
                // Filter to meetings that have ended (meaning they should have transcripts processed)
                const ended = allMeetings.filter((m: any) => m.status === 'ended');
                setTranscripts(ended);
            } catch (e) {
                console.error("Failed to fetch transcripts", e);
            } finally {
                setLoading(false);
            }
        };
        fetchTranscripts();
    }, []);

    const filtered = transcripts.filter(t =>
        t.title?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Transcripts</h1>
                    <p className="text-slate-500">Access text records of all your recorded sessions.</p>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search transcripts..."
                        className="pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100">
                    <h3 className="font-bold text-slate-800 flex items-center">
                        <FileText size={18} className="mr-2 text-indigo-500" />
                        Recent Transcripts
                    </h3>
                </div>

                {loading ? (
                    <div className="p-8 text-center text-slate-500">Loading transcripts...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                        <FileText size={48} className="text-slate-200 mb-4" />
                        <p>No transcripts generated yet.</p>
                        <p className="text-sm mt-1">Transcripts will appear here after a recorded meeting ends.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filtered.map(t => (
                            <div key={t.id} className="p-4 hover:bg-slate-50 flex items-center justify-between group">
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800">{t.title}</h4>
                                        <p className="text-xs text-slate-500">Generated on {new Date(t.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => navigate(`/recording/${t.id}`)} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="View">
                                        <Eye size={18} />
                                    </button>
                                    <button className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Download">
                                        <Download size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
