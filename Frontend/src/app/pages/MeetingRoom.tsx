import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
import {
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff,
  MessageSquare, Users, Sparkles, X, Wifi, Pause, Play, Disc,
  Settings, Send, LayoutDashboard, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useParams, useNavigate, useLocation } from 'react-router';
import { joinMeeting, startMeeting, endMeeting, getLiveAI, insertTranscript, startRecording, stopRecording, getMeeting, uploadRecording } from '../api';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useLocalParticipant,
  useParticipants,
  useRoomContext,
  useConnectionState,
  useChat
} from '@livekit/components-react';
import '@livekit/components-styles';

const getLocalUser = () => {
  const userStr = localStorage.getItem('currentUser');
  return userStr ? JSON.parse(userStr) : { role: 'student', name: 'Student', email: 'guest@student.com' };
};

// We separate the actual room content into a child component so it can use LiveKit hooks
function MeetingContent({ activeMeetingId, isRecording, setIsRecording, showRightPanel, setShowRightPanel, meetingData }: any) {
  const devUser = getLocalUser();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const participants = useParticipants();
  const navigate = useNavigate();
  const { send, chatMessages, isSending } = useChat();
  const [chatInput, setChatInput] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [liveTranscripts, setLiveTranscripts] = useState<any[]>([]);
  const [mediaError, setMediaError] = useState("");
  const [canPlaybackAudio, setCanPlaybackAudio] = useState(room.canPlaybackAudio);
  const [showDebug, setShowDebug] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [isHandRaised, setIsHandRaised] = useState(false);

  // Admin manual transcript injection states
  const [manualSpeaker, setManualSpeaker] = useState("System");
  const [manualText, setManualText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const [micLocked, setMicLocked] = useState(devUser.role !== 'teacher');
  const [camLocked, setCamLocked] = useState(devUser.role !== 'teacher');
  const [screenLocked, setScreenLocked] = useState(devUser.role !== 'teacher');
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const recordingStartedRef = useRef(false);
  const recordingIntendedStopRef = useRef(false);

  // Auto-start recording for teacher
  useEffect(() => {
    if (devUser.role === 'teacher' && connectionState === 'connected' && !isRecording && !recordingStartedRef.current) {
      recordingStartedRef.current = true;
      recordingIntendedStopRef.current = false;
      handleToggleRecording();
    }
  }, [devUser.role, connectionState, isRecording]);

  const setupMediaRecorder = (stream: MediaStream) => {
    let mimeOptions = 'video/webm;codecs=vp8,opus';
    if (!MediaRecorder.isTypeSupported(mimeOptions)) {
      mimeOptions = 'video/webm';
    }

    const mediaRecorder = new MediaRecorder(stream, { mimeType: mimeOptions });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // If we didn't intend to stop (e.g. user clicked "Stop sharing" on Chrome's built-in banner)
      if (!recordingIntendedStopRef.current) {
        console.log("Stream ended but class isn't over. Falling back to camera/mic.");
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setupMediaRecorder(fallbackStream);
        } catch (e) {
          console.error("Fallback recording failed", e);
        }
        return;
      }

      // If we *did* intend to stop (End Class button)
      const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
      try {
        await uploadRecording(activeMeetingId, blob);
        console.log("Recording uploaded successfully");
        setMediaError("Recording saved to server");
      } catch (e) {
        console.error("Failed to upload recording", e);
        setMediaError("Failed to upload recording to server");
      }
      setTimeout(() => setMediaError(""), 3000);
      recordedChunks.current = [];
      setIsRecording(false);
      setIsRecordingPaused(false);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        if (!isRecordingPaused) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.enabled = false);
          setIsRecordingPaused(true);
        } else {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.enabled = true);
          setIsRecordingPaused(false);
        }
      }
    } else {
      try {
        recordingIntendedStopRef.current = false;

        // Try getting screen share first
        let combinedStream;
        try {
          const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: true });
          combinedStream = displayStream;

          try {
            const mStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            combinedStream = new MediaStream([...displayStream.getTracks(), ...mStream.getAudioTracks()]);
          } catch (e) {
            console.warn("Could not get mic for recording overlay", e);
          }
        } catch (e) {
          console.warn("Could not get display media. Falling back to camera+mic", e);
          const mStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          combinedStream = mStream;
        }

        setupMediaRecorder(combinedStream);
        await startRecording(activeMeetingId);
        setIsRecording(true);
        setIsRecordingPaused(false);
      } catch (e: any) {
        console.error("Failed to start auto-recording:", e);
        setMediaError("Recording failed or permission denied.");
        setTimeout(() => setMediaError(""), 5000);
      }
    }
  };

  const handleManualInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualText.trim() || !activeMeetingId) return;
    try {
      await insertTranscript(activeMeetingId, manualSpeaker, manualText);
      setManualText("");
      // Will be fetched automatically by the polling useEffect
    } catch (e) {
      console.error("Failed to inject transcript", e);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => setElapsedTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeMeetingId) return;
    const fetchAi = async () => {
      try {
        const data = await getLiveAI(activeMeetingId);
        setAiSuggestions(data.suggestions || []);
        if (data.transcripts) {
          setLiveTranscripts(data.transcripts.reverse()); // Show earliest to latest if backend returns DESC
        }
      } catch (err) {
        console.error("Failed to fetch live AI", err);
      }
    };
    fetchAi(); // initial
    const interval = setInterval(fetchAi, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [activeMeetingId]);

  useEffect(() => {
    const handleAudioPlaybackChanged = (canPlayback: boolean) => {
      setCanPlaybackAudio(canPlayback);
    };
    room.on('audioPlaybackChanged', handleAudioPlaybackChanged);

    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);

        if (devUser.role !== 'teacher') {
          if (data.type === 'MUTE_ALL') {
            localParticipant?.setMicrophoneEnabled(false);
          } else if (data.type === 'LOCK_MIC') {
            localParticipant?.setMicrophoneEnabled(false);
            setMicLocked(true);
          } else if (data.type === 'UNLOCK_MIC') {
            setMicLocked(false);
          } else if (data.type === 'LOCK_CAM') {
            localParticipant?.setCameraEnabled(false);
            setCamLocked(true);
          } else if (data.type === 'UNLOCK_CAM') {
            setCamLocked(false);
          } else if (data.type === 'LOCK_SCREEN') {
            localParticipant?.setScreenShareEnabled(false);
            setScreenLocked(true);
          } else if (data.type === 'UNLOCK_SCREEN') {
            setScreenLocked(false);
          } else if (data.type === 'TOGGLE_MIC' && localParticipant?.identity === data.targetIdentity) {
            localParticipant?.setMicrophoneEnabled(false);
          } else if (data.type === 'GRANT_MIC' && localParticipant?.identity === data.targetIdentity) {
            setMicLocked(false);
            setMediaError("Teacher has granted you permission to speak.");
            setTimeout(() => setMediaError(""), 3000);
          } else if (data.type === 'FORCE_TAB') {
            setShowRightPanel(data.tab);
          }
        }

        if (data.type === 'HAND_RAISE') {
          setRaisedHands(prev => new Set(prev).add(data.identity));
        } else if (data.type === 'LOWER_HAND') {
          setRaisedHands(prev => {
            const next = new Set(prev);
            next.delete(data.identity);
            return next;
          });
          if (localParticipant?.identity === data.identity) {
            setIsHandRaised(false);
          }
        } else if (data.type === 'LOWER_ALL_HANDS') {
          setRaisedHands(new Set());
          setIsHandRaised(false);
        }
      } catch (e) { }
    };
    room.on('dataReceived', handleDataReceived);

    // In case LiveKit STT is enabled on server
    const handleTranscription = (segments: any[], participant?: any) => {
      const name = participant?.identity || 'Speaker';
      for (const seg of segments) {
        if (seg.isFinal && seg.text && seg.text.trim().length > 0) {
          if (activeMeetingId) {
            insertTranscript(activeMeetingId, name, seg.text).catch(e => console.error("Transcript insert error:", e));
          }
        }
      }
    };
    room.on('transcriptionReceived', handleTranscription);

    setCanPlaybackAudio(room.canPlaybackAudio);
    return () => {
      room.off('audioPlaybackChanged', handleAudioPlaybackChanged);
      room.off('dataReceived', handleDataReceived);
      room.off('transcriptionReceived', handleTranscription);
    };
  }, [room, devUser, activeMeetingId]);

  // Fallback: Use Browser Speech Recognition since local LiveKit doesn't have an STT agent configured
  useEffect(() => {
    let recognition: any = null;
    if (SpeechRecognition && isMicrophoneEnabled && activeMeetingId && localParticipant) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        if (transcript.trim().length > 0) {
          const speakerName = devUser.role === 'teacher' ? `Teacher ${devUser.name}` : `Student ${devUser.name}`;
          insertTranscript(activeMeetingId, speakerName, transcript).catch(e => console.error(e));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech Recognition Error:", event.error);
        if (event.error === 'not-allowed') {
          // fatal, we don't try to restart
          recognition.stoppedByError = true;
        }
      };

      recognition.onend = () => {
        // Automatically restart speech recognition after silence or completion
        if (!recognition.stoppedByError && isMicrophoneEnabled) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (e) { }
          }, 1000);
        }
      };

      try {
        recognition.start();
      } catch (e) { }
    }

    return () => {
      if (recognition) {
        recognition.stoppedByError = true; // prevent auto-restart on unmount
        try {
          recognition.stop();
        } catch (e) { }
      }
    };
  }, [isMicrophoneEnabled, activeMeetingId, localParticipant, devUser]);

  const sendCommand = (cmd: any) => {
    if (localParticipant) {
      const encoded = new TextEncoder().encode(JSON.stringify(cmd));
      localParticipant.publishData(encoded, { reliable: true });
    }
  };

  const handleRaiseHand = () => {
    if (!isHandRaised) {
      sendCommand({ type: 'HAND_RAISE', identity: localParticipant?.identity });
      setIsHandRaised(true);
    } else {
      sendCommand({ type: 'LOWER_HAND', identity: localParticipant?.identity });
      setIsHandRaised(false);
    }
  };

  const grantSpeakingPermission = (identity: string) => {
    sendCommand({ type: 'GRANT_MIC', targetIdentity: identity });
    sendCommand({ type: 'LOWER_HAND', identity: identity });
  };

  const lowerStudentHand = (identity: string) => {
    sendCommand({ type: 'LOWER_HAND', identity: identity });
  };

  const lowerAllHands = () => {
    sendCommand({ type: 'LOWER_ALL_HANDS' });
    setRaisedHands(new Set());
  };

  const syncDashboardTab = () => {
    sendCommand({ type: 'FORCE_TAB', tab: 'dashboard' });
  };

  const toggleMic = async () => {
    if (!localParticipant) return;
    if (micLocked && !isMicrophoneEnabled) {
      setMediaError("Teacher has disabled microphones for students.");
      setTimeout(() => setMediaError(""), 3000);
      return;
    }
    try {
      console.log(`[MeetingRoom] Toggling mic from ${isMicrophoneEnabled} to ${!isMicrophoneEnabled}`);
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
      setMediaError("");
    } catch (e: any) {
      console.error("[MeetingRoom] Microphone error:", e);
      setMediaError(`Microphone error: ${e.message || "Permission denied"}`);
      setTimeout(() => setMediaError(""), 5000);
    }
  };

  const toggleCamera = async () => {
    if (!localParticipant) return;
    if (camLocked && !isCameraEnabled) {
      setMediaError("Teacher has disabled cameras for students.");
      setTimeout(() => setMediaError(""), 3000);
      return;
    }
    try {
      console.log(`[MeetingRoom] Toggling camera from ${isCameraEnabled} to ${!isCameraEnabled}`);
      await localParticipant.setCameraEnabled(!isCameraEnabled);
      setMediaError("");
    } catch (e: any) {
      console.error("[MeetingRoom] Camera error:", e);
      setMediaError(`Camera error: ${e.message || "Permission denied"}`);
      setTimeout(() => setMediaError(""), 5000);
    }
  };

  const toggleScreenShare = async () => {
    if (!localParticipant) return;
    if (screenLocked && !isScreenShareEnabled) {
      setMediaError("Teacher has disabled screen sharing for students.");
      setTimeout(() => setMediaError(""), 3000);
      return;
    }
    try {
      await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
      setMediaError("");
    } catch (e: any) {
      console.error("[MeetingRoom] Screen share error:", e);
      setMediaError(`Screen share error: ${e.message || "Permission denied"}`);
      setTimeout(() => setMediaError(""), 5000);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !send) return;
    try {
      await send(chatInput);
      setChatInput("");
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };


  return (
    <>
      {/* Top Bar */}
      <header className="h-14 flex items-center justify-between px-4 bg-slate-900/90 border-b border-slate-800 z-10 w-full">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm">{meetingData?.title || 'Meeting Room'}</span>
            <span className="px-2 py-0.5 bg-slate-800 rounded text-xs text-slate-400 capitalize">{meetingData?.mode || 'Hybrid'} Mode</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
            <div className={"w-2 h-2 rounded-full " + (isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-600')}></div>
            <span>{formatTime(elapsedTime)}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1 bg-indigo-900/50 border border-indigo-500/30 rounded-full flex items-center space-x-2">
            <Sparkles size={12} className="text-indigo-400" />
            <span className="text-xs text-indigo-300 font-medium">AI Agent Active</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative w-full">
        {mediaError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl shadow-lg z-50 flex items-center animate-in slide-in-from-top-4">
            <span className="font-semibold text-sm mr-2">{mediaError}</span>
            <button onClick={() => setMediaError("")} className="text-red-200 hover:text-white"><X size={16} /></button>
          </div>
        )}

        {!canPlaybackAudio && (
          <div className="absolute top-4 left-4 bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg z-50 flex items-center space-x-3 cursor-pointer hover:bg-amber-600 transition-colors" onClick={() => room.startAudio()}>
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-bounce">
              <Mic size={16} />
            </div>
            <div>
              <p className="text-sm font-bold">Click to Enable Audio</p>
              <p className="text-[10px] text-amber-100 mt-0.5">Browser blocked autoplay for remote users.</p>
            </div>
          </div>
        )}

        {isHandRaised && devUser.role === 'student' && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center space-x-2 backdrop-blur-sm animate-bounce">
            <Sparkles size={14} />
            <span className="text-xs font-bold">Your hand is raised</span>
            <button onClick={handleRaiseHand} className="text-[10px] bg-white text-amber-600 px-2 py-0.5 rounded-full font-bold ml-2">Lower</button>
          </div>
        )}

        {showDebug && (
          <div className="absolute top-20 left-4 bg-black/80 text-green-400 font-mono text-[10px] p-4 rounded-xl shadow-xl z-50 w-72 backdrop-blur-sm border border-green-500/30">
            <h4 className="border-b border-green-500/50 pb-1 mb-2 font-bold text-green-300">LiveKit Dev Debug</h4>
            <div className="space-y-1">
              <p>Room: {room.name}</p>
              <p>State: {room.state}</p>
              <p>Connection: {connectionState}</p>
              <p>Audio Playback: {canPlaybackAudio ? 'Allowed' : 'Blocked'}</p>
              <p>Mic Published: {isMicrophoneEnabled ? 'Yes' : 'No'}</p>
              <p>Cam Published: {isCameraEnabled ? 'Yes' : 'No'}</p>
              <p>My Identity: {localParticipant?.identity}</p>
              <p>Mic Tracks: {localParticipant?.audioTrackPublications.size || 0}</p>
              <p>Cam Tracks: {localParticipant?.videoTrackPublications.size || 0}</p>
            </div>
          </div>
        )}

        <div className="flex-1 p-4 flex items-center justify-center bg-black/20 livekit-custom-container h-full">
          <VideoConference />
          <RoomAudioRenderer />
        </div>

        {/* Right Panel */}
        <AnimatePresence>
          {showRightPanel && (
            <motion.div
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 300, opacity: 0 }}
              className="w-80 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 h-full"
            >
              <div className="h-12 border-b border-slate-200 flex items-center justify-between px-4 bg-slate-50">
                <h3 className="font-semibold text-slate-800 text-sm uppercase tracking-wide">
                  {showRightPanel === 'chat' && 'Meeting Chat'}
                  {showRightPanel === 'participants' && 'Participants (' + participants.length + ')'}
                  {showRightPanel === 'ai' && 'AI Assistant'}
                  {showRightPanel === 'admin' && 'Admin Panel'}
                  {showRightPanel === 'dashboard' && 'Class Dashboard'}
                </h3>
                <button onClick={() => setShowRightPanel(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                {showRightPanel === 'chat' && (
                  <div className="space-y-4">
                    {chatMessages.map((msg: any, idx: number) => {
                      const isMe = msg.from?.isLocal;
                      const senderName = isMe ? "Me" : (msg.from?.identity || "Unknown");
                      const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div key={idx} className={"flex flex-col " + (isMe ? 'items-end' : 'items-start')}>
                          <div className={"flex items-baseline space-x-2 mb-1 " + (isMe ? 'flex-row-reverse space-x-reverse' : '')}>
                            <span className="text-xs font-bold text-slate-700">{senderName}</span>
                            <span className="text-[10px] text-slate-400">{time}</span>
                          </div>
                          <div className={"px-3 py-2 rounded-lg text-sm max-w-[85%] break-words " + (
                            isMe ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                          )}>
                            {msg.message}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showRightPanel === 'ai' && (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 p-4 rounded-xl">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-xs font-semibold text-indigo-700">Listening & Analyzing...</span>
                      </div>
                      <div className="space-y-3">
                        {aiSuggestions.length === 0 ? (
                          <div className="text-sm text-slate-500 italic p-2 items-center flex">Waiting for discussion points...</div>
                        ) : aiSuggestions.map((s: string, i: number) => (
                          <div key={i} className="flex items-start space-x-2 text-sm text-slate-700 bg-white p-2 rounded border border-indigo-50 shadow-sm">
                            <Sparkles size={14} className="mt-0.5 text-indigo-500 flex-shrink-0" />
                            <span>{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Live Transcript</h4>
                      <div className="text-xs text-slate-600 space-y-2 font-mono h-40 overflow-y-auto bg-white p-2 rounded border border-slate-200 flex flex-col-reverse">
                        {liveTranscripts.length === 0 ? (
                          <p className="text-slate-400 italic">No transcripts yet.</p>
                        ) : liveTranscripts.map((t: any, idx: number) => (
                          <p key={idx}><span className="text-indigo-600 font-bold">{t.speaker}:</span> {t.text}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {showRightPanel === 'dashboard' && (
                  <div className="space-y-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Participation Sync</h4>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2">
                          <Users size={16} className="text-indigo-500" />
                          <span className="text-sm font-semibold">{participants.length} Active</span>
                        </div>
                        {devUser.role === 'teacher' && (
                          <button
                            onClick={syncDashboardTab}
                            className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                          >
                            Sync to All
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500">Class Focus</span>
                          <span className="text-emerald-500 font-bold">High (85%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full w-[85%]"></div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                      <h4 className="text-xs font-bold text-indigo-700 uppercase mb-2">Topic Progress</h4>
                      <div className="space-y-2">
                        {['Introduction', 'Core Architecture', 'Permission Logic'].map((topic: string, i: number) => (
                          <div key={i} className="flex items-center space-x-2">
                            <div className="w-4 h-4 rounded-full border border-indigo-300 flex items-center justify-center">
                              {i === 0 && <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>}
                            </div>
                            <span className={`text-xs ${i === 0 ? 'text-indigo-900 font-semibold' : 'text-indigo-400 font-medium'}`}>{topic}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(devUser.role === 'teacher' ? '/dashboard' : '/student-home')}
                      className="w-full py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center space-x-2"
                    >
                      <ArrowUpRight size={14} />
                      <span>Full Dashboard</span>
                    </button>
                  </div>
                )}

                {showRightPanel === 'participants' && (
                  <div className="space-y-4">
                    {devUser.role === 'teacher' && (
                      <div className="space-y-2 mb-4 border-b border-slate-200 pb-4">
                        <button
                          onClick={() => sendCommand({ type: 'MUTE_ALL' })}
                          className="w-full bg-red-50 text-red-600 border border-red-200 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                        >
                          Mute All Students
                        </button>
                        <button
                          onClick={lowerAllHands}
                          className="w-full bg-amber-50 text-amber-600 border border-amber-200 py-2 rounded-lg text-sm font-semibold hover:bg-amber-100 transition-colors"
                        >
                          Lower All Hands
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => sendCommand({ type: 'LOCK_MIC' })}
                            className="bg-slate-800 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                          >
                            Lock Mics
                          </button>
                          <button
                            onClick={() => sendCommand({ type: 'UNLOCK_MIC' })}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            Unlock Mics
                          </button>
                          <button
                            onClick={() => sendCommand({ type: 'LOCK_CAM' })}
                            className="bg-slate-800 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                          >
                            Lock Cams
                          </button>
                          <button
                            onClick={() => sendCommand({ type: 'UNLOCK_CAM' })}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            Unlock Cams
                          </button>
                          <button
                            onClick={() => sendCommand({ type: 'LOCK_SCREEN' })}
                            className="bg-slate-800 text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                          >
                            Lock Screens
                          </button>
                          <button
                            onClick={() => sendCommand({ type: 'UNLOCK_SCREEN' })}
                            className="bg-emerald-50 text-emerald-700 border border-emerald-200 py-1.5 rounded-lg text-xs font-semibold hover:bg-emerald-100 transition-colors"
                          >
                            Unlock Screens
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      {participants.map((p: any) => (
                        <div key={p.identity} className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors group">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600">
                                {p.identity.charAt(0).toUpperCase()}
                              </div>
                              {raisedHands.has(p.identity) && (
                                <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 border border-white">
                                  <Sparkles size={8} />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-slate-800 flex items-center gap-1">
                                {p.identity}
                                {raisedHands.has(p.identity) && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded font-bold">Raised Hand</span>}
                              </p>
                              <p className="text-[10px] text-slate-500">{p.isLocal ? "Me" : "Remote"}</p>
                            </div>
                          </div>
                          <div className="flex space-x-2 items-center">
                            <div className="flex space-x-1">
                              {!p.isMicrophoneEnabled ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} className="text-slate-400" />}
                              {!p.isCameraEnabled ? <VideoOff size={14} className="text-red-400" /> : <Video size={14} className="text-slate-400" />}
                            </div>
                            {devUser.role === 'teacher' && !p.isLocal && (
                              <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {raisedHands.has(p.identity) && (
                                  <button
                                    onClick={() => grantSpeakingPermission(p.identity)}
                                    className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700"
                                  >
                                    Allow
                                  </button>
                                )}
                                {raisedHands.has(p.identity) && (
                                  <button
                                    onClick={() => lowerStudentHand(p.identity)}
                                    className="text-[10px] bg-amber-600 text-white px-2 py-0.5 rounded hover:bg-amber-700"
                                  >
                                    Lower
                                  </button>
                                )}
                                {p.isMicrophoneEnabled && (
                                  <button
                                    onClick={() => sendCommand({ type: 'TOGGLE_MIC', targetIdentity: p.identity })}
                                    className="text-[10px] bg-slate-800 text-white px-2 py-0.5 rounded hover:bg-slate-700"
                                  >
                                    Mute
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showRightPanel === 'admin' && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-700">Inject Transcript (Testing)</h4>
                    <form onSubmit={handleManualInject} className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Speaker Name</label>
                        <input
                          type="text"
                          className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800"
                          value={manualSpeaker}
                          onChange={e => setManualSpeaker(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Transcript Text</label>
                        <textarea
                          className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800"
                          rows={3}
                          value={manualText}
                          onChange={e => setManualText(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-semibold text-sm transition-colors">
                        Send to DB
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {showRightPanel === 'chat' && (
                <div className="flex flex-col h-full">
                  <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Type a message..."
                        className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        disabled={isSending}
                      />
                      <button type="submit" disabled={isSending} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-600 hover:text-indigo-700 p-1 disabled:opacity-50">
                        <Send size={16} />
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Control Bar */}
      <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 z-20 w-full shrink-0">
        <div className="flex items-center space-x-4 w-1/4">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400">Connection: Excellent</span>
            <span className="text-[10px] text-emerald-500 flex items-center gap-1">
              <Wifi size={10} /> LiveKit Connected
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-3 w-1/2">
          <ControlButton
            icon={isMicrophoneEnabled ? Mic : MicOff}
            active={isMicrophoneEnabled}
            onClick={toggleMic}
            label={isMicrophoneEnabled ? "Mute" : "Unmute"}
            variant="secondary"
          />
          <ControlButton
            icon={isCameraEnabled ? Video : VideoOff}
            active={isCameraEnabled}
            onClick={toggleCamera}
            label={isCameraEnabled ? "Stop Video" : "Start Video"}
            variant="secondary"
          />

          <div className="h-8 w-px bg-slate-700 mx-2"></div>

          <ControlButton
            icon={Monitor}
            active={isScreenShareEnabled}
            onClick={toggleScreenShare}
            label="Share"
            variant="secondary"
          />

          {devUser.role === 'student' && (
            <ControlButton
              icon={Sparkles}
              active={isHandRaised}
              onClick={handleRaiseHand}
              label={isHandRaised ? "Lower Hand" : "Raise Hand"}
              variant={isHandRaised ? 'ai' : 'ghost'}
            />
          )}

          {devUser.role === 'teacher' && (
            <>
              <button
                onClick={handleToggleRecording}
                disabled={!isRecording}
                className={"flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all " + (
                  isRecordingPaused
                    ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                    : isRecording
                      ? 'bg-slate-800 text-amber-500 hover:bg-slate-700 text-amber-400'
                      : 'bg-slate-800 text-slate-400 opacity-50 cursor-not-allowed'
                )}
              >
                {isRecordingPaused ? <Play size={24} /> : <Pause size={24} />}
                <span className="text-[10px] mt-1 font-medium">{!isRecording ? "Starting..." : isRecordingPaused ? "Resume" : "Pause"}</span>
              </button>

              <div className="h-8 w-px bg-slate-700 mx-2"></div>
            </>
          )}

          <button
            onClick={async () => {
              if (devUser.role === 'teacher' && activeMeetingId) {
                const saveRec = window.confirm("Do you want to end the class and publish the recording?");
                try {
                  if (saveRec && isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    // Set our flag so onstop knows to upload instead of restarting
                    recordingIntendedStopRef.current = true;
                    // This triggers onstop which uploads the video
                    mediaRecorderRef.current.stop();
                    mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
                    await stopRecording(activeMeetingId);
                  }
                  await endMeeting(activeMeetingId);
                } catch (e) {
                  console.error("Failed to end class actions:", e);
                }
              }
              room.disconnect();
              navigate(devUser.role === 'teacher' ? '/dashboard' : '/student-home');
            }}
            className="flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-red-900/20 cursor-pointer"
          >
            <PhoneOff size={18} className="mr-2" />
            {devUser.role === 'teacher' ? 'End Class' : 'Leave Class'}
          </button>
        </div>

        <div className="flex items-center justify-end space-x-2 w-1/4">
          <ControlButton
            icon={MessageSquare}
            active={showRightPanel === 'chat'}
            onClick={() => setShowRightPanel(showRightPanel === 'chat' ? null : 'chat')}
            label="Chat"
            variant="ghost"
          />
          <ControlButton
            icon={Users}
            active={showRightPanel === 'participants'}
            onClick={() => setShowRightPanel(showRightPanel === 'participants' ? null : 'participants')}
            label="People"
            variant="ghost"
          />
          <ControlButton
            icon={Sparkles}
            active={showRightPanel === 'ai'}
            onClick={() => setShowRightPanel(showRightPanel === 'ai' ? null : 'ai')}
            label="AI Agent"
            variant="ai"
          />
          <ControlButton
            icon={LayoutDashboard}
            active={showRightPanel === 'dashboard'}
            onClick={() => setShowRightPanel(showRightPanel === 'dashboard' ? null : 'dashboard')}
            label="Dashboard"
            variant="ghost"
          />
          {devUser.role === 'teacher' && (
            <>
              <ControlButton
                icon={Settings}
                active={showRightPanel === 'admin'}
                onClick={() => setShowRightPanel(showRightPanel === 'admin' ? null : 'admin')}
                label="Admin"
                variant="ghost"
              />
              <ControlButton
                icon={Monitor}
                active={showDebug}
                onClick={() => setShowDebug(!showDebug)}
                label="Debug"
                variant="ghost"
              />
            </>
          )}
        </div>
      </footer>
    </>
  );
}

export function MeetingRoom() {
  const { id } = useParams();
  const location = useLocation();
  const [isRecording, setIsRecording] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState<'chat' | 'participants' | 'ai' | 'dashboard' | 'admin' | null>('dashboard');
  const [connectionDetails, setConnectionDetails] = useState<any>(null);
  const [meetingError, setMeetingError] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [meetingData, setMeetingData] = useState<any>(null);

  const searchParams = new URLSearchParams(location.search);
  const activeMeetingId = id || searchParams.get('id');
  const devUser = getLocalUser();

  useEffect(() => {
    const initMeeting = async () => {
      if (!activeMeetingId) {
        setMeetingError("Invalid meeting ID");
        return;
      }

      try {
        console.log(`[MeetingRoom] Attempting to join meeting ID: ${activeMeetingId}`);
        const joinData = await joinMeeting(activeMeetingId);
        console.log(`[MeetingRoom] Successfully joined meeting. Connection details:`, joinData);

        try {
          const mData = await getMeeting(activeMeetingId);
          setMeetingData(mData);
        } catch (e) {
          console.warn("[MeetingRoom] Failed to fetch meeting details:", e);
        }

        // If teacher, formally start the meeting to trigger recording/AI workflows later
        if (devUser.role === 'teacher') {
          try {
            console.log(`[MeetingRoom] Teacher automatically starting meeting ID: ${activeMeetingId}`);
            await startMeeting(activeMeetingId);
          } catch (e) {
            console.warn("[MeetingRoom] Meeting already started or error starting:", e);
          }
        }

        setConnectionDetails(joinData);
      } catch (err: any) {
        console.error("[MeetingRoom] Failed to join:", err);
        setMeetingError("Failed to join: " + err.message);
      }
    };

    initMeeting();
  }, [activeMeetingId]);

  return (
    <div className="h-screen bg-slate-900 text-white overflow-hidden flex flex-col relative">
      {!connectionDetails ? (
        <div className="flex flex-col items-center justify-center space-y-4 h-full">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-indigo-200 font-medium">{meetingError || "Connecting to classroom..."}</p>
        </div>
      ) : !hasJoined ? (
        <div className="flex flex-col items-center justify-center space-y-6 h-full p-8 absolute inset-0 z-50 bg-slate-900">
          <div className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-700">
            <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video size={32} className="text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ready to join?</h2>
            <p className="text-slate-400 text-sm mb-8">Make sure you are in a quiet environment.</p>
            <button onClick={() => setHasJoined(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-500/30">
              Join Classroom
            </button>
          </div>
        </div>
      ) : (
        <LiveKitRoom
          video={devUser.role === 'teacher'}
          audio={devUser.role === 'teacher'}
          connect={true}
          token={connectionDetails.token}
          serverUrl={connectionDetails.livekit_ws_url}
          data-lk-theme="default"
          style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
        >
          <MeetingContent
            activeMeetingId={activeMeetingId}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            showRightPanel={showRightPanel}
            setShowRightPanel={setShowRightPanel}
            meetingData={meetingData}
          />
        </LiveKitRoom>
      )}
    </div>
  );
}

function ControlButton({ icon: Icon, active, onClick, label, variant = 'secondary' }: any) {
  let bgClass = '';
  let iconClass = '';

  if (variant === 'secondary') {
    bgClass = active ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500/10 text-red-500 hover:bg-red-500/20';
    if (active) iconClass = 'text-white';
  } else if (variant === 'ghost') {
    bgClass = active ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400 hover:bg-slate-800';
  } else if (variant === 'ai') {
    bgClass = active ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-indigo-400 hover:bg-indigo-900/30';
  }

  return (
    <button
      onClick={onClick}
      className={"flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all " + bgClass}
    >
      <Icon size={22} className={iconClass} />
      <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
  );
}
