import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Search, Download, FileText, Share2,
  MessageSquare, Users, Clock
} from 'lucide-react';
import { getTranscript, getMeeting, getAttendance } from '../api';

export function TranscriptViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'transcript' | 'attendance'>('transcript');
  const [transcriptData, setTranscriptData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [meet, transcriptRes, attendanceRes] = await Promise.all([
          getMeeting(id).catch(() => null),
          getTranscript(id).catch(() => null),
          getAttendance(id).catch(() => [])
        ]);

        if (meet) setMeetingData(meet);
        if (attendanceRes) setAttendanceData(attendanceRes);

        if (transcriptRes && transcriptRes.content) {
          try {
            const parsed = JSON.parse(transcriptRes.content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTranscriptData(parsed);
            } else {
              setTranscriptData([]);
            }
          } catch (e) {
            console.error("Failed to parse transcript JSON", e);
            setTranscriptData([]);
          }
        }
      } catch (e) {
        console.error("Failed to load viewer data", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const filteredTranscript = transcriptData.filter(line =>
    line.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    line.speaker?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAttendance = attendanceData.filter(record =>
    record.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0 min';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-6">
      {/* Video Player Section */}
      <div className="lg:w-2/3 flex flex-col space-y-4">
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative aspect-video group flex flex-col items-center justify-center border border-slate-800">
          <video
            src={`http://localhost:8080/api/meetings/${id}/recording/video`}
            controls
            className="w-full h-full object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">{meetingData?.title || 'Meeting Transcript'}</h2>
            <p className="text-slate-500 text-sm">
              Recorded on {meetingData?.created_at ? new Date(meetingData.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown Date'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate(`/mom/${id}`)}
              className="flex items-center px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium transition-colors border border-purple-100"
            >
              <FileText size={16} className="mr-2" />
              View MOM
            </button>
            <button className="flex items-center px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors border border-slate-200">
              <Download size={16} className="mr-2" />
              Download
            </button>
            <button className="flex items-center px-4 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 text-sm font-medium transition-colors border border-slate-200">
              <Share2 size={16} className="mr-2" />
              Share
            </button>
          </div>
        </div>
      </div>

      {/* Side Panel (Transcript / Attendance) */}
      <div className="lg:w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">

        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 flex items-center justify-center py-4 text-sm font-bold transition-colors ${activeTab === 'transcript' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <MessageSquare size={16} className="mr-2" />
            Transcript
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 flex items-center justify-center py-4 text-sm font-bold transition-colors ${activeTab === 'attendance' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Users size={16} className="mr-2" />
            Attendance
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={`Search in ${activeTab}...`}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading && (
            <div className="text-center py-10 text-slate-400">
              <p>Loading {activeTab}...</p>
            </div>
          )}

          {/* Transcript Tab Content */}
          {!loading && activeTab === 'transcript' && (
            <>
              {filteredTranscript.map((line, idx) => (
                <div key={idx} className="group hover:bg-slate-50 p-2 rounded-lg transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${line.speaker.includes('Prof') || line.speaker.includes('Teacher') ? 'text-indigo-600' : 'text-slate-600'}`}>
                      {line.speaker}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                      {line.time}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {line.text}
                  </p>
                </div>
              ))}
              {filteredTranscript.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <Search size={32} className="mx-auto mb-2 opacity-50" />
                  <p>{transcriptData.length === 0 ? 'No transcript available' : 'No matches found'}</p>
                </div>
              )}
            </>
          )}

          {/* Attendance Tab Content */}
          {!loading && activeTab === 'attendance' && (
            <div className="space-y-3">
              {filteredAttendance.map((record, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${record.role === 'teacher' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                      {record.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">{record.name}</p>
                      <p className="text-xs text-slate-500 capitalize">{record.role}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-1 text-xs text-slate-600 font-medium justify-end mb-1">
                      <Clock size={12} className="text-slate-400" />
                      <span>{formatDuration(record.duration_seconds)}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      {formatTime(record.join_time)} - {formatTime(record.leave_time)}
                    </p>
                  </div>
                </div>
              ))}
              {filteredAttendance.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p>{attendanceData.length === 0 ? 'No attendance records yet' : 'No matches found'}</p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
