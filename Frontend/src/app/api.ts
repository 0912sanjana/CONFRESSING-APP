import { MeetingMode, UserRole } from './types';
import { devUser } from '../devUser';

const API_BASE_URL = 'http://localhost:8080/api';

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-dev-user-id': devUser.id,
    'x-dev-user-name': devUser.name,
    'x-dev-user-email': devUser.email,
    'x-dev-user-role': devUser.role,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = 'API Error';
    const text = await response.text();
    try {
      if (text) {
        const errorData = JSON.parse(text);
        errorMessage = errorData.message || errorMessage;
      }
    } catch (e) {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// User API
export const createUser = (email: string, name: string, role: UserRole) =>
  fetchApi<{ id: string, email: string, name: string, role: string }>('/users', {
    method: 'POST',
    body: JSON.stringify({ email, name, role }),
  });

// Meeting Auth
export const joinMeeting = (meetingId: string) =>
  fetchApi<{ token: string, livekit_ws_url: string, room_name: string, meeting_id: string }>(`/meetings/${meetingId}/join`, {
    method: 'POST',
  });

// Meetings Management
export const createMeeting = (data: { title: string, description?: string, mode: string }) =>
  fetchApi<any>('/meetings', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const scheduleMeeting = (data: { title: string, description?: string, mode: MeetingMode, scheduled_start: string, scheduled_end: string, course_id?: string, batch_id?: string, subject_id?: string, planned_topics?: any }) =>
  fetchApi<any>('/meetings/schedule', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getTimetable = (batchId?: string) =>
  fetchApi<any[]>(batchId ? `/meetings/timetable?batch_id=${batchId}` : '/meetings/timetable');

export const getMeetings = () =>
  fetchApi<any[]>('/meetings');

export const getMeeting = (meetingId: string) =>
  fetchApi<any>(`/meetings/${meetingId}`);

export const startMeeting = (meetingId: string) =>
  fetchApi('/meetings/' + meetingId + '/start', { method: 'POST' });

export const endMeeting = (meetingId: string) =>
  fetchApi('/meetings/' + meetingId + '/end', { method: 'POST' });

export const startRecording = (meetingId: string) =>
  fetchApi('/meetings/' + meetingId + '/recording/start', { method: 'POST' });

export const stopRecording = (meetingId: string) =>
  fetchApi('/meetings/' + meetingId + '/recording/stop', { method: 'POST' });

export const uploadRecording = async (meetingId: string, blob: Blob) => {
  const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/recording/upload`, {
    method: 'POST',
    body: blob,
  });
  if (!res.ok) throw new Error('Failed to upload recording');
  return res.json();
};

// AI Retrievals
export const getTranscript = (meetingId: string) =>
  fetchApi<{ content: string | null }>(`/meetings/${meetingId}/transcript`);

export const getSummary = (meetingId: string) =>
  fetchApi<{ content: string | null }>(`/meetings/${meetingId}/summary`);

export const getMom = (meetingId: string) =>
  fetchApi<{ key_points: string[] | null, action_items: string[] | null }>(`/meetings/${meetingId}/mom`);

export const getTopics = (meetingId: string) =>
  fetchApi<any[]>(`/meetings/${meetingId}/topics`);

// Teacher Analytics
export const getTeacherContribution = (teacherId: string) =>
  fetchApi<any[]>(`/teachers/${teacherId}/contribution`);

export const getDashboard = async () => {
  const userStr = localStorage.getItem('currentUser');
  let userId = devUser.id;
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user.id) userId = user.id;
    } catch (e) { }
  }
  const res = await fetchApi<any>(`/dashboard/${userId}`);
  return res;
};

export const getLiveAI = async (meetingId: string) => {
  const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/live-ai`);
  if (!res.ok) throw new Error('Failed to get live ai');
  return res.json();
};

export const insertTranscript = async (meetingId: string, speaker: string, text: string) => {
  const res = await fetch(`${API_BASE_URL}/meetings/${meetingId}/transcript`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speaker, text })
  });
  if (!res.ok) throw new Error('Failed to insert transcript');
  return res.json();
};
