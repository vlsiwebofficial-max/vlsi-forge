import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '../App';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, Clock, BarChart2, BookOpen, Zap, ArrowRight } from 'lucide-react';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-xl p-5 hover:border-[#D0D0D0] hover:shadow-sm transition-all">
      <div className="text-2xl font-bold tracking-tight" style={{ color: accent || '#111111' }}>
        {value ?? '—'}
      </div>
      <div className="text-sm font-medium text-[#111111] mt-1">{label}</div>
      {sub && <div className="text-xs text-[#AAAAAA] mt-0.5">{sub}</div>}
    </div>
  );
}

const STATUS_CONFIG = {
  passed: { color: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Passed' },
  failed: { color: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed' },
  error:  { color: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', icon: <Zap className="w-3.5 h-3.5" />, label: 'Error' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/stats/me`, { withCredentials: true }),
      axios.get(`${API}/api/submissions/user/me`, { withCredentials: true })
    ]).then(([statsRes, subsRes]) => {
      setStats(statsRes.data);
      setSubmissions(subsRes.data.slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#AAAAAA] uppercase mb-1.5">Overview</p>
            <h1 className="text-2xl font-bold text-[#111111] tracking-tight">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
          </div>
          <Link
            to="/problems"
            className="inline-flex items-center gap-1.5 bg-[#111111] hover:bg-[#333333] text-white text-sm font-semibold px-4 py-2 rounded-md transition-colors"
          >
            Browse Problems <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-[#E8E8E8] rounded-xl h-24 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              label="Problems Solved"
              value={stats?.problems_solved ?? 0}
              sub="unique problems"
              accent="#111111"
            />
            <StatCard
              label="Submissions"
              value={stats?.total_submissions ?? 0}
              sub="total attempts"
              accent="#2563EB"
            />
            <StatCard
              label="Acceptance Rate"
              value={stats?.acceptance_rate != null ? `${(stats.acceptance_rate * 100).toFixed(0)}%` : '—'}
              sub="pass rate"
              accent="#16A34A"
            />
            <StatCard
              label="Streak"
              value={stats?.streak != null ? `${stats.streak}d` : '0d'}
              sub="active days"
              accent="#D97706"
            />
          </div>
        )}

        {/* Submissions table */}
        <div className="bg-white border border-[#E8E8E8] rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F0]">
            <h2 className="font-semibold text-[#111111]">Recent Submissions</h2>
            <Link to="/problems" className="text-xs text-[#555555] hover:text-[#111111] font-medium flex items-center gap-1 transition-colors">
              View all problems <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 bg-[#F5F5F5] rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-5 h-5 text-[#AAAAAA]" />
              </div>
              <p className="text-[#888888] text-sm font-medium">No submissions yet</p>
              <p className="text-[#BBBBBB] text-xs mt-1 mb-5">Pick a problem and start coding</p>
              <Link to="/problems" className="inline-flex items-center gap-1.5 bg-[#111111] text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-[#333333] transition-colors">
                Start solving <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div>
              {/* Header row */}
              <div className="grid grid-cols-12 px-5 py-2.5 bg-[#FAFAFA] border-b border-[#F0F0F0]">
                <div className="col-span-2 text-[10px] font-semibold tracking-widest text-[#AAAAAA] uppercase">Status</div>
                <div className="col-span-6 text-[10px] font-semibold tracking-widest text-[#AAAAAA] uppercase">Problem</div>
                <div className="col-span-2 text-[10px] font-semibold tracking-widest text-[#AAAAAA] uppercase hidden sm:block">Tests</div>
                <div className="col-span-2 text-[10px] font-semibold tracking-widest text-[#AAAAAA] uppercase hidden sm:block">Date</div>
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                {submissions.map(sub => {
                  const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.error;
                  return (
                    <Link
                      key={sub.submission_id}
                      to={`/submissions/${sub.submission_id}`}
                      className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors group"
                    >
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-md ${cfg.color} ${cfg.bg}`}>
                          {cfg.icon}
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </span>
                      </div>
                      <div className="col-span-6 text-sm text-[#333333] group-hover:text-[#111111] font-medium truncate pr-4 transition-colors">
                        {sub.problem_id}
                      </div>
                      <div className="col-span-2 hidden sm:block">
                        <span className="text-xs font-mono text-[#888888]">
                          {sub.passed_count}/{sub.total_count}
                        </span>
                      </div>
                      <div className="col-span-2 hidden sm:flex items-center gap-1.5 text-xs text-[#AAAAAA]">
                        <Clock className="w-3 h-3 shrink-0" />
                        {new Date(sub.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Difficulty breakdown */}
        {!loading && stats && (
          <div className="mt-6 grid grid-cols-3 gap-4">
            {[
              { label: 'Easy', value: stats.easy_solved ?? 0, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
              { label: 'Medium', value: stats.medium_solved ?? 0, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
              { label: 'Hard', value: stats.hard_solved ?? 0, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
            ].map(({ label, value, color, bg, border }) => (
              <div key={label} className="bg-white border border-[#E8E8E8] rounded-xl p-4 text-center hover:shadow-sm transition-all">
                <div className="text-xl font-bold tracking-tight" style={{ color }}>{value}</div>
                <div className="mt-1">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}>
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Graph placeholder label */}
        {!loading && stats && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#AAAAAA]">
              <BarChart2 className="w-3.5 h-3.5" />
              Keep solving problems to grow your stats
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
