export type UserRole = 'teacher' | 'student' | 'admin';
export type MeetingMode = 'online' | 'offline' | 'hybrid';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Meeting {
  id: string;
  title: string;
  description?: string;
  date: string;
  duration: number; // minutes
  mode: MeetingMode;
  hostId: string;
  participants: number;
  status: 'scheduled' | 'live' | 'completed';
  recordingStatus?: 'recording' | 'paused' | 'stopped';
}

export interface Recording {
  id: string;
  meetingId: string;
  title: string;
  date: string;
  duration: string;
  size: string;
  transcriptStatus: 'processing' | 'ready' | 'failed';
  momStatus: 'processing' | 'ready' | 'failed';
}

export interface TranscriptLine {
  id: string;
  timestamp: string;
  speaker: string;
  text: string;
  highlight?: boolean;
}

export interface MOM {
  id: string;
  meetingId: string;
  summary: string;
  keyTopics: string[];
  decisions: string[];
  actionItems: { task: string; assignee: string }[];
}
