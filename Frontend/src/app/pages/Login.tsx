import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { UserRole } from '../types';
import { User, Lock, Mail, ArrowRight, ShieldCheck, GraduationCap } from 'lucide-react';
import { createUser } from '../api';
import { devUser } from '../../devUser';

export function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>('student');
  const [mode, setMode] = useState<'login' | 'join'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [meetingId, setMeetingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    // Check if already logged in
    const existingStr = localStorage.getItem('currentUser');
    if (existingStr) {
      const existingUser = JSON.parse(existingStr);
      if (existingUser.role === 'teacher' || existingUser.role === 'admin') {
        navigate('/schedule');
      } else {
        navigate('/student-home');
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setLoading(true);

    // Mock login logic depending on selected role
    const mockUser = {
      id: "mock-" + Math.random().toString(36).substr(2, 9),
      name: name || (role === 'teacher' ? 'Test Teacher' : 'Test Student'),
      email: email,
      role: role
    };

    setTimeout(() => {
      localStorage.setItem('currentUser', JSON.stringify(mockUser));
      setLoading(false);

      if (mockUser.role === 'teacher' || mockUser.role === 'admin') {
        navigate('/schedule');
      } else {
        navigate('/student-home');
      }
    }, 500); // simulate network delay
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      setError('Please enter your name');
      return;
    }

    // Quick guest join route (bypassing full login)
    localStorage.setItem('guestName', name);
    navigate(`/meeting/${meetingId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1693269276499-5d71d866785f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG1pbmltYWwlMjBibHVlJTIwdGVjaG5vbG9neSUyMGJhY2tncm91bmQlMjB3aGl0ZXxlbnwxfHx8fDE3NzE2MDUwOTd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')] bg-cover bg-center opacity-10"></div>
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[20%] left-[-10%] w-96 h-96 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/80 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 p-8 m-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg mb-4 transform rotate-3">
            <span className="text-2xl font-bold tracking-tighter">K</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight text-center">KIIT Hybrid Conferencing</h1>
          <p className="text-sm text-slate-500 font-medium mt-1">Institutional Access Portal</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'login'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            Login
          </button>
          <button
            onClick={() => setMode('join')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${mode === 'join'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
              }`}
          >
            Join Class
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Role Selection */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div
                onClick={() => setRole('teacher')}
                className={`cursor-pointer p-3 border rounded-xl flex flex-col items-center justify-center transition-all ${role === 'teacher'
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-500'
                  }`}
              >
                <ShieldCheck size={20} className="mb-1" />
                <span className="text-xs font-semibold">Teacher</span>
              </div>
              <div
                onClick={() => setRole('student')}
                className={`cursor-pointer p-3 border rounded-xl flex flex-col items-center justify-center transition-all ${role === 'student'
                  ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-500'
                  }`}
              >
                <GraduationCap size={20} className="mb-1" />
                <span className="text-xs font-semibold">Student</span>
              </div>
            </div>

            {error && <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">{error}</div>}

            <div className="space-y-4">
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="text"
                  placeholder="Full Name (Optional)"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="relative group">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="email"
                  placeholder="University Email / ID"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                <input
                  type="password"
                  placeholder="Password"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span>Remember me</span>
              </label>
              <a href="#" className="text-indigo-600 hover:underline">Forgot Password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              <span>{loading ? 'Signing In...' : 'Sign In Securely'}</span>
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} className="space-y-5">
            <div className="text-center mb-2">
              <p className="text-sm text-slate-600">Enter the meeting code provided by your instructor to join instantly.</p>
            </div>

            {error && <div className="text-red-500 text-sm p-2 bg-red-50 text-center rounded-lg">{error}</div>}

            <div className="relative group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 font-bold">#</div>
              <input
                type="text"
                placeholder="Meeting Code (e.g. CS-101-L5)"
                className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all uppercase"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                required
              />
            </div>

            <div className="relative group">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Your Name"
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all transform hover:-translate-y-0.5 flex items-center justify-center space-x-2"
            >
              <span>Join Class Now</span>
              <ArrowRight size={18} />
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            Protected by KIIT Enterprise Security. <br />
            Trouble signing in? <a href="#" className="text-indigo-600 hover:underline">Contact IT Support</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
