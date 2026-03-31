import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '../App';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, Clock, BarChart2, BookOpen, Zap } from 'lucide-react';

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-[#13171E] border border-[#1E2530] rounded-xl p-5 flex items-center gap-4">
      <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-[#E8EDF4]">{value ?? '—'}</div>
        <div className="text-sm text-[#7A8FA8]">{label}</div>
      </div>
    </div>
  );
}

const statusColors = { passed: 'text-[#22C55E]', failed: 'text-[#EF4444]', error: 'text-[#F59E0B]' };
const statusIcons = { passed: <CheckCircle className="w-4 h-4" />, failed: <XCircle className="w-4 h-4" />, error: <Zap className="w-4 h-4" /> };

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/api/stats/me`, { headers }),
      axios.get(`${API}/api/submissions/user/me`, { headers })
    ]).then(([statsRes, subsRes]) => {
      setStats(statsRes.data);
      setSubmissions(subsRes.data.slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-[#7A8FA8] mt-1 text-sm">Here's your progress overview</p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-[#13171E] border border-[#1E2530] rounded-xl h-20 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={<BookOpen className="w-5 h-5 text-[#4A8FE8]" />} label="Problems Solved" value={stats?.problems_solved} color="bg-[#4A8FE8]/10" />
            <StatCard icon={<CheckCircle className="w-5 h-5 text-[#22C55E]" />} label="Total Submissions" value={stats?.total_submissions} color="bg-[#22C55E]/10" />
            <StatCard icon={<BarChart2 className="w-5 h-5 text-[#F59E0B]" />} label="Acceptance Rate" value={stats?.acceptance_rate != null ? `${(stats.acceptance_rate * 100).toFixed(0)}%` : '—'} color="bg-[#F59E0B]/10" />
            <StatCard icon={<Zap className="w-5 h-5 text-[#A855F7]" />} label="Streak" value={stats?.streak != null ? `${stats.streak} days` : '0 days'} color="bg-[#A855F7]/10" />
          </div>
        )}

        {/* Recent Submissions */}
        <div className="bg-[#13171E] border border-[#1E2530] rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2530]">
            <h2 className="font-semibold text-[#E8EDF4]">Recent Submissions</h2>
            <Link to="/problems" className="text-sm text-[#4A8FE8] hover:underline">Browse Problems →</Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-[#1A1F28] rounded-lg animate-pulse" />)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-10 text-center">
              <BookOpen className="w-10 h-10 text-[#1E2530] mx-auto mb-3" />
              <p className="text-[#7A8FA8] text-sm">No submissions yet.</p>
              <Link to="/problems" className="mt-3 inline-block text-sm text-[#4A8FE8] hover:underline">Start solving problems →</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#1E2530]">
              {submissions.map(sub => (
                <Link key={sub.submission_id} to={`/submissions/${sub.submission_id}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-[#1A1F28] transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`${statusColors[sub.status]} flex items-center gap-1 text-sm font-medium shrink-0`}>
                      {statusIcons[sub.status]} {sub.status}
                    </span>
                    <span className="text-[#E8EDF4] text-sm truncate">{sub.problem_id}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#7A8FA8] shrink-0">
                    <span>{sub.passed_count}/{sub.total_count} tests</span>
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(sub.submitted_at).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
