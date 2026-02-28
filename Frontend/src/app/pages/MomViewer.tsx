import React from 'react';
import {
  FileText, CheckCircle, Clock, Target, Download, Share2,
  Edit3, ThumbsUp, ThumbsDown, User, Calendar
} from 'lucide-react';
import { useParams } from 'react-router';
import { getSummary, getMom, getMeeting } from '../api';

export function MomViewer() {
  const { id } = useParams();
  const [summary, setSummary] = React.useState<string | null>(null);
  const [keyPoints, setKeyPoints] = React.useState<string[] | null>(null);
  const [actionItems, setActionItems] = React.useState<string[] | null>(null);
  const [meetingData, setMeetingData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [summaryData, momData, meetData] = await Promise.all([
          getSummary(id),
          getMom(id).catch(() => ({ key_points: null, action_items: null })),
          getMeeting(id).catch(() => null)
        ]);
        setSummary(summaryData.content);
        if (meetData) setMeetingData(meetData);
        if (momData) {
          setKeyPoints(momData.key_points);
          setActionItems(momData.action_items);
        }
      } catch (err) {
        console.error("Failed to load MOM data", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center space-x-2 text-indigo-600 mb-1">
            <FileText size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">Minutes of Meeting</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-800">{meetingData?.title || 'Minutes of Meeting'}</h1>
          <div className="flex items-center space-x-4 mt-2 text-sm text-slate-500">
            <div className="flex items-center">
              <Calendar size={14} className="mr-1.5" />
              {meetingData?.created_at ? new Date(meetingData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
            </div>
            <div className="flex items-center">
              <Clock size={14} className="mr-1.5" />
              {meetingData?.created_at ? new Date(meetingData.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          </div>
        </div>

        <div className="flex space-x-3">
          <button className="flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors shadow-sm">
            <Edit3 size={16} className="mr-2 text-slate-400" />
            Edit
          </button>
          <button className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium text-sm transition-colors shadow-md shadow-indigo-500/20">
            <Download size={16} className="mr-2" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Document Content */}
        <div className="lg:col-span-2 space-y-8">

          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center mr-3 text-indigo-600">
                <FileText size={18} />
              </span>
              Executive Summary
            </h2>
            <p className="text-slate-600 leading-relaxed">
              {loading ? "Loading summary..." : (summary || "No summary generated for this meeting yet.")}
            </p>
          </section>

          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center mr-3 text-emerald-600">
                <Target size={18} />
              </span>
              Key Decisions / Concepts
            </h2>
            <ul className="space-y-3">
              {loading ? (
                <li className="text-slate-500">Loading key points...</li>
              ) : keyPoints && keyPoints.length > 0 ? (
                keyPoints.map((point, idx) => (
                  <li key={idx} className="flex items-start">
                    <div className="mt-1.5 mr-3 w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                    <span className="text-slate-700">{point}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500">No key points recorded.</li>
              )}
            </ul>
          </section>

          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
              <span className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center mr-3 text-amber-600">
                <CheckCircle size={18} />
              </span>
              Action Items
            </h2>
            <div className="space-y-3">
              {loading ? (
                <div className="text-slate-500">Loading action items...</div>
              ) : actionItems && actionItems.length > 0 ? (
                actionItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center space-x-3">
                      <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-slate-700">{item}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">No action items found.</div>
              )}
            </div>
          </section>

        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">

          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-5 rounded-xl border border-indigo-100">
            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wide mb-3">AI Analysis</h3>
            <div className="space-y-4">
              <div>
                <span className="text-xs text-indigo-500 font-medium block mb-1">Sentiment</span>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div className="w-[85%] h-full bg-emerald-500 rounded-full"></div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">Positive</span>
                </div>
              </div>
              <div>
                <span className="text-xs text-indigo-500 font-medium block mb-1">Engagement</span>
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-2 bg-white rounded-full overflow-hidden">
                    <div className="w-[60%] h-full bg-amber-500 rounded-full"></div>
                  </div>
                  <span className="text-xs font-bold text-amber-600">Medium</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Topics Discussed</h3>
            <div className="flex flex-wrap gap-2">
              {['Data', 'Insights', 'AI'].map((tag, i) => (
                <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-center">
            <h3 className="text-sm font-medium text-slate-600 mb-4">Was this summary helpful?</h3>
            <div className="flex justify-center space-x-4">
              <button className="p-2 rounded-full hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 transition-colors">
                <ThumbsUp size={20} />
              </button>
              <button className="p-2 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                <ThumbsDown size={20} />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
