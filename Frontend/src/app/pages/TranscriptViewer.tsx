import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Search, Download, FileText, Share2,
  MessageSquare
} from 'lucide-react';
import { getTranscript, getMeeting } from '../api';


export function TranscriptViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [transcriptData, setTranscriptData] = useState<any[]>([]);
  const [meetingData, setMeetingData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [meet, data] = await Promise.all([
          getMeeting(id).catch(() => null),
          getTranscript(id).catch(() => null)
        ]);
        if (meet) setMeetingData(meet);

        if (data && data.content) {
          try {
            const parsed = JSON.parse(data.content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setTranscriptData(parsed);
            } else {
              setTranscriptData([]); // No transcripts yet
            }
          } catch (e) {
            console.error("Failed to parse transcript JSON", e);
            setTranscriptData([]);
          }
        }
      } catch (e) {
        console.error("Failed to load transcript", e);
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

      {/* Transcript Panel */}
      <div className="lg:w-1/3 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center">
            <MessageSquare size={18} className="mr-2 text-indigo-600" />
            Transcript
          </h3>
          <button className="text-indigo-600 text-sm font-medium hover:underline">Export PDF</button>
        </div>

        <div className="p-3 border-b border-slate-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search in transcript..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {filteredTranscript.map((line, idx) => (
            <div key={idx} className="group hover:bg-slate-50 p-2 rounded-lg transition-colors cursor-pointer">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-bold ${line.speaker.includes('Prof') ? 'text-indigo-600' : 'text-slate-600'}`}>
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
          {loading && (
            <div className="text-center py-10 text-slate-400">
              <p>Loading transcript...</p>
            </div>
          )}
          {!loading && filteredTranscript.length === 0 && (
            <div className="text-center py-10 text-slate-400">
              <Search size={32} className="mx-auto mb-2 opacity-50" />
              <p>{transcriptData.length === 0 ? 'No transcript available' : 'No matches found'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
