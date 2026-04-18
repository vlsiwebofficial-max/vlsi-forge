import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, API } from '../App';
import { cachedGet } from '../utils/apiCache';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, Clock, BarChart2, BookOpen, Zap, ArrowRight } from 'lucide-react';

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 shadow-card shadow-card-hover">
      <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: accent || '#111111' }}>
        {value ?? '—'}
      </div>
      <div className="text-sm font-semibold text-[#111111]">{label}</div>
      {sub && <div className="text-xs text-[#AAAAAA] mt-0.5">{sub}</div>}
    </div>
  );
}

const STATUS_CFG = {
  passed: { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Passed' },
  failed: { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Failed' },
  error:  { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]',  icon: <Zap className="w-3.5 h-3.5" />,      label: 'Error'  },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      cachedGet(`${API}/api/stats/me`, { withCredentials: true }),
      cachedGet(`${API}/api/submissions/user/me`, { withCredentials: true })
    ]).then(([s, sub]) => {
      setStats(s.data);
      setSubmissions(sub.data.slice(0, 8));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 flex items-end justify-between flex-wrap gap-4 animate-fade-up">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-[#BBBBBB] uppercase mb-1.5">Overview</p>
            <h1 className="text-[26px] font-extrabold text-[#111111] tracking-tight">
              Welcome back, {user?.name?.split(' ')[0]}
            </h1>
          </div>
          <Link
            to="/problems"
            className="inline-flex items-center gap-1.5 bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-btn"
          >
            Browse Problems <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white border border-[#E8E8E8] rounded-2xl h-24 shimmer shadow-card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-up stagger">
            <StatCard label="Solved"      value={stats?.problems_solved ?? 0}    sub="problems"    accent="#111111" />
            <StatCard label="Submissions" value={stats?.total_submissions ?? 0}  sub="total"       accent="#2563EB" />
            <StatCard label="Acceptance"  value={stats?.acceptance_rate != null ? `${(stats.acceptance_rate * 100).toFixed(0)}%` : '—'} sub="pass rate" accent="#16A34A" />
            <StatCard label="Streak"      value={stats?.streak != null ? `${stats.streak}d` : '0d'} sub="active days" accent="#D97706" />
          </div>
        )}

        {/* Submissions */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden shadow-card">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
            <h2 className="font-bold text-[#111111] text-[15px]">Recent Submissions</h2>
            <Link to="/problems" className="text-xs text-[#888888] hover:text-[#111111] font-semibold flex items-center gap-1">
              All problems <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-2.5">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-xl shimmer" style={{ opacity: 1 - i * 0.14 }} />
              ))}
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-5 h-5 text-[#CCCCCC]" />
              </div>
              <p className="text-[#888888] text-sm font-semibold">No submissions yet</p>
              <p className="text-[#CCCCCC] text-xs mt-1 mb-5">Pick a problem and start coding</p>
              <Link to="/problems" className="inline-flex items-center gap-1.5 bg-[#111111] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2A2A2A] shadow-btn">
                Start solving <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-12 px-6 py-2.5 bg-[#FAFAFA] border-b border-[#F5F5F5]">
                <div className="col-span-2 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">Status</div>
                <div className="col-span-6 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">Problem</div>
                <div className="col-span-2 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase hidden sm:block">Tests</div>
                <div className="col-span-2 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase hidden sm:block">Date</div>
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                {submissions.map(sub => {
                  const cfg = STATUS_CFG[sub.status] || STATUS_CFG.error;
                  return (
                    <Link key={sub.submission_id} to={`/submissions/${sub.submission_id}`}
                      className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-[#FAFAFA] transition-all group">
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                          {cfg.icon}
                          <span className="hidden sm:inline">{cfg.label}</span>
                        </span>
                      </div>
                      <div className="col-span-6 text-sm text-[#444444] group-hover:text-[#111111] font-medium truncate pr-4">
                        {sub.problem_id}
                      </div>
                      <div className="col-span-2 hidden sm:block text-xs font-mono text-[#AAAAAA]">
                        {sub.passed_count}/{sub.total_count}
                      </div>
                      <div className="col-span-2 hidden sm:flex items-center gap-1.5 text-xs text-[#CCCCCC]">
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

        {/* Difficulty row */}
        {!loading && stats && (
          <div className="mt-5 grid grid-cols-3 gap-4 animate-fade-up">
            {[
              { label: 'Easy',   value: stats.easy_solved   ?? 0, text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
              { label: 'Medium', value: stats.medium_solved ?? 0, text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
              { label: 'Hard',   value: stats.hard_solved   ?? 0, text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
            ].map(({ label, value, text, bg, border }) => (
              <div key={label} className="bg-white border border-[#E8E8E8] rounded-2xl p-4 text-center shadow-card shadow-card-hover">
                <div className={`text-2xl font-extrabold tracking-tight mb-1 ${text}`}>{value}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${text} ${bg} ${border}`}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && stats && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#CCCCCC]">
              <BarChart2 className="w-3.5 h-3.5" />
              Keep solving to grow your stats
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
