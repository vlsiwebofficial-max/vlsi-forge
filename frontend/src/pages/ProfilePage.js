import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, API } from '../App';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, Zap, Clock, ArrowRight, Trophy } from 'lucide-react';

const DOMAIN_COLOR = {
  'RTL Design':          '#2563EB',
  'Design Verification': '#16A34A',
  'Computer Architecture':'#9333EA',
  'Debug & Analysis':    '#D97706',
  'Programming':         '#DB2777',
  'Timing & Power':      '#0891B2',
};

const DIFF_STYLE = {
  Easy:   { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
  Medium: { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  Hard:   { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
};

const STATUS_CFG = {
  passed: { icon: <CheckCircle className="w-3.5 h-3.5"/>, text:'text-[#16A34A]', bg:'bg-[#F0FDF4]', border:'border-[#BBF7D0]', label:'Passed' },
  failed: { icon: <XCircle     className="w-3.5 h-3.5"/>, text:'text-[#DC2626]', bg:'bg-[#FEF2F2]', border:'border-[#FECACA]', label:'Failed' },
  error:  { icon: <Zap         className="w-3.5 h-3.5"/>, text:'text-[#D97706]', bg:'bg-[#FFFBEB]', border:'border-[#FDE68A]', label:'Error'  },
};

// ─── Activity Heatmap ─────────────────────────────────────────────────────────
function ActivityHeatmap({ days }) {
  // Build a map of date → count
  const countMap = useMemo(() => {
    const m = {};
    days.forEach(d => { m[d.date] = d.count; });
    return m;
  }, [days]);

  // Build 52 weeks × 7 days grid ending today
  const grid = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    // Go back to last Sunday
    const endSunday = new Date(today);
    endSunday.setDate(today.getDate() + (7 - today.getDay()) % 7);
    // Start = 51 weeks + current partial week before endSunday
    const start = new Date(endSunday);
    start.setDate(endSunday.getDate() - 52 * 7 + 1);

    const weeks = [];
    let week = [];
    const cur = new Date(start);
    while (cur <= endSunday) {
      const iso = cur.toISOString().slice(0, 10);
      const isFuture = cur > today;
      week.push({ date: iso, count: isFuture ? -1 : (countMap[iso] || 0), isFuture });
      if (week.length === 7) { weeks.push(week); week = []; }
      cur.setDate(cur.getDate() + 1);
    }
    if (week.length) weeks.push(week);
    return weeks;
  }, [countMap]);

  const maxCount = useMemo(() => Math.max(1, ...days.map(d => d.count)), [days]);

  const cellColor = (count, isFuture) => {
    if (isFuture || count < 0) return '#F3F4F6';
    if (count === 0) return '#EEEEEE';
    const intensity = Math.min(1, count / Math.max(4, maxCount));
    if (intensity < 0.25) return '#C7D2FE'; // very light indigo
    if (intensity < 0.5)  return '#818CF8';
    if (intensity < 0.75) return '#4F46E5';
    return '#312E81';
  };

  const DAYS   = ['','Mon','','Wed','','Fri',''];

  // Month labels: find first column where month changes
  const monthLabels = useMemo(() => {
    const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const labels = [];
    let lastMonth = -1;
    grid.forEach((week, wi) => {
      const d = new Date(week[0].date);
      const m = d.getMonth();
      if (m !== lastMonth) { labels.push({ wi, label: MON[m] }); lastMonth = m; }
    });
    return labels;
  }, [grid]);

  const totalSubmissions = days.reduce((a, d) => a + d.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-[#888888]">{totalSubmissions} submissions · {activeDays} active days in the last year</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#AAAAAA]">Less</span>
          {['#EEEEEE','#C7D2FE','#818CF8','#4F46E5','#312E81'].map(c => (
            <div key={c} className="w-3 h-3 rounded-sm" style={{ background: c }}/>
          ))}
          <span className="text-[10px] text-[#AAAAAA]">More</span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 0 }}>
          {/* Month labels row */}
          <div style={{ display: 'flex', marginLeft: 24, marginBottom: 4 }}>
            {grid.map((_, wi) => {
              const lbl = monthLabels.find(m => m.wi === wi);
              return (
                <div key={wi} style={{ width: 13, marginRight: 2, flexShrink: 0 }}>
                  {lbl && <span style={{ fontSize: 9, color: '#AAAAAA', whiteSpace: 'nowrap' }}>{lbl.label}</span>}
                </div>
              );
            })}
          </div>

          {/* Day rows */}
          {[0,1,2,3,4,5,6].map(dayIdx => (
            <div key={dayIdx} style={{ display: 'flex', alignItems: 'center', marginBottom: 2 }}>
              <div style={{ width: 20, flexShrink: 0 }}>
                <span style={{ fontSize: 9, color: '#AAAAAA' }}>{DAYS[dayIdx]}</span>
              </div>
              {grid.map((week, wi) => {
                const cell = week[dayIdx];
                if (!cell) return <div key={wi} style={{ width: 13, height: 13, marginRight: 2 }}/>;
                return (
                  <div
                    key={wi}
                    title={cell.count >= 0 ? `${cell.date}: ${cell.count} submission${cell.count!==1?'s':''}` : ''}
                    style={{
                      width: 13, height: 13, marginRight: 2, borderRadius: 3,
                      background: cellColor(cell.count, cell.isFuture),
                      flexShrink: 0,
                      cursor: cell.count > 0 ? 'default' : 'default',
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5 shadow-card text-center">
      <div className="text-3xl font-extrabold tracking-tight mb-1" style={{ color: accent || '#111111' }}>{value ?? '—'}</div>
      <div className="text-xs font-semibold text-[#888888]">{label}</div>
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-[#F0F0F0] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }}/>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const [stats,       setStats]       = useState(null);
  const [heatmap,     setHeatmap]     = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [solvedData,  setSolvedData]  = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.allSettled([
      axios.get(`${API}/api/stats/me`,              { withCredentials: true }),
      axios.get(`${API}/api/stats/heatmap`,         { withCredentials: true }),
      axios.get(`${API}/api/submissions/user/me`,   { withCredentials: true }),
      axios.get(`${API}/api/stats/solved-problems`, { withCredentials: true }),
    ]).then(([sR, hR, subR, solR]) => {
      if (sR.status   === 'fulfilled') setStats(sR.value.data);
      if (hR.status   === 'fulfilled') setHeatmap(hR.value.data.days || []);
      if (subR.status === 'fulfilled') setSubmissions(subR.value.data.slice(0, 10));
      if (solR.status === 'fulfilled') setSolvedData(solR.value.data);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Profile header ───────────────────────────────────────── */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-card mb-6 animate-fade-up">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl bg-[#111111] flex items-center justify-center shadow-btn shrink-0">
              <span className="text-2xl font-black text-white">{user?.name?.[0]?.toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight">{user?.name}</h1>
              <p className="text-sm text-[#888888] mt-0.5">{user?.email}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#888888] bg-[#F5F5F5] border border-[#EBEBEB] px-2.5 py-1 rounded-full">
                  <Trophy className="w-3.5 h-3.5 text-[#D97706]"/>
                  {stats?.problems_solved ?? 0} problems solved
                </span>
                {stats?.streak > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#888888] bg-[#F5F5F5] border border-[#EBEBEB] px-2.5 py-1 rounded-full">
                    🔥 {stats.streak}d streak
                  </span>
                )}
              </div>
            </div>
            <Link to="/leaderboard" className="hidden sm:flex items-center gap-1.5 text-sm font-semibold text-[#888888] hover:text-[#111111] px-3 py-1.5 rounded-lg hover:bg-[#F5F5F5] transition-colors">
              <Trophy className="w-4 h-4"/> Leaderboard
            </Link>
          </div>
        </div>

        {/* ── Stat cards ───────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_,i) => <div key={i} className="h-24 rounded-2xl shimmer"/>)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade-up stagger">
            <StatCard label="Solved"      value={stats?.problems_solved ?? 0}   accent="#111111"/>
            <StatCard label="Submissions" value={stats?.total_submissions ?? 0} accent="#2563EB"/>
            <StatCard label="Acceptance"  value={stats?.acceptance_rate != null ? `${(stats.acceptance_rate*100).toFixed(0)}%` : stats?.accuracy != null ? `${stats.accuracy.toFixed(0)}%` : '—'} accent="#16A34A"/>
            <StatCard label="Streak"      value={stats?.streak != null ? `${stats.streak}d` : '0d'} accent="#D97706"/>
          </div>
        )}

        {/* ── Activity heatmap ──────────────────────────────────────── */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-card mb-6 animate-fade-up">
          <h2 className="font-bold text-[#111111] text-[15px] mb-4">Activity</h2>
          {loading || heatmap === null ? (
            <div className="h-28 rounded-xl shimmer"/>
          ) : (
            <ActivityHeatmap days={heatmap}/>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Difficulty breakdown ────────────────────────────────── */}
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-card animate-fade-up">
            <h2 className="font-bold text-[#111111] text-[15px] mb-4">Difficulty Breakdown</h2>
            {loading ? (
              <div className="space-y-3">{[...Array(3)].map((_,i)=><div key={i} className="h-8 rounded-lg shimmer"/>)}</div>
            ) : (
              <div className="space-y-4">
                {[
                  { label:'Easy',   value: stats?.easy_solved   ?? 0, total: 15, color:'#16A34A', ds: DIFF_STYLE.Easy   },
                  { label:'Medium', value: stats?.medium_solved ?? 0, total: 13, color:'#D97706', ds: DIFF_STYLE.Medium },
                  { label:'Hard',   value: stats?.hard_solved   ?? 0, total:  5, color:'#DC2626', ds: DIFF_STYLE.Hard   },
                ].map(({ label, value, total, color, ds }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${ds.text} ${ds.bg} ${ds.border}`}>{label}</span>
                      <span className="text-xs font-mono text-[#888888]">{value} / {total}</span>
                    </div>
                    <ProgressBar value={value} max={total} color={color}/>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Topics progress ──────────────────────────────────────── */}
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-6 shadow-card animate-fade-up">
            <h2 className="font-bold text-[#111111] text-[15px] mb-4">Topics</h2>
            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_,i)=><div key={i} className="h-7 rounded-lg shimmer"/>)}</div>
            ) : (
              <div className="space-y-3">
                {Object.entries(DOMAIN_COLOR).map(([domain, color]) => {
                  const solved = solvedData?.domain_solved?.[domain] || 0;
                  if (solved === 0 && !solvedData) return null;
                  return (
                    <div key={domain}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }}/>
                          <span className="text-xs font-medium text-[#444444]">{domain}</span>
                        </div>
                        <span className="text-xs font-mono text-[#AAAAAA]">{solved}</span>
                      </div>
                      <ProgressBar value={solved} max={Math.max(solved, 5)} color={color}/>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Submissions ───────────────────────────────────── */}
        <div className="mt-6 bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden shadow-card animate-fade-up">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F0]">
            <h2 className="font-bold text-[#111111] text-[15px]">Recent Submissions</h2>
            <Link to="/problems" className="text-xs text-[#888888] hover:text-[#111111] font-semibold flex items-center gap-1">
              Browse problems <ArrowRight className="w-3 h-3"/>
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-2.5">
              {[...Array(5)].map((_,i)=><div key={i} className="h-10 rounded-xl shimmer" style={{opacity:1-i*0.14}}/>)}
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-[#888888] text-sm">No submissions yet</p>
              <Link to="/problems" className="mt-3 inline-flex items-center gap-1.5 bg-[#111111] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2A2A2A] shadow-btn">
                Start solving <ArrowRight className="w-3.5 h-3.5"/>
              </Link>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-12 px-6 py-2.5 bg-[#FAFAFA] border-b border-[#F5F5F5]">
                <div className="col-span-2 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">Status</div>
                <div className="col-span-5 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">Problem</div>
                <div className="col-span-2 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase hidden sm:block">Tests</div>
                <div className="col-span-3 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase hidden sm:block">Date</div>
              </div>
              <div className="divide-y divide-[#F5F5F5]">
                {submissions.map(sub => {
                  const cfg = STATUS_CFG[sub.status] || STATUS_CFG.error;
                  return (
                    <Link key={sub.submission_id} to={`/submissions/${sub.submission_id}`}
                      className="grid grid-cols-12 items-center px-6 py-3.5 hover:bg-[#FAFAFA] transition-all group">
                      <div className="col-span-2">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                          {cfg.icon}<span className="hidden sm:inline">{cfg.label}</span>
                        </span>
                      </div>
                      <div className="col-span-5 text-sm text-[#444444] group-hover:text-[#111111] font-medium truncate pr-4">{sub.problem_id}</div>
                      <div className="col-span-2 hidden sm:block text-xs font-mono text-[#AAAAAA]">{sub.passed_count}/{sub.total_count}</div>
                      <div className="col-span-3 hidden sm:flex items-center gap-1.5 text-xs text-[#CCCCCC]">
                        <Clock className="w-3 h-3 shrink-0"/>
                        {new Date(sub.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
