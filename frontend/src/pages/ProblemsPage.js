import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import { Search, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

// ─── Domain config ──────────────────────────────────────────────────────────
const DOMAINS = [
  {
    id: 'all',
    label: 'All Problems',
    color: '#111111',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      </svg>
    ),
  },
  {
    id: 'RTL Design',
    label: 'RTL Design',
    color: '#2563EB',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 7 H4 V4 H10 V10 H4 V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M10 5.5 H13 M10 8.5 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'Design Verification',
    label: 'Design Verification',
    color: '#16A34A',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7.5 L5.5 11 L12 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Computer Architecture',
    label: 'Computer Architecture',
    color: '#9333EA',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="5" y="5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 1V3M9 1V3M5 11V13M9 11V13M1 5H3M1 9H3M11 5H13M11 9H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'Debug & Analysis',
    label: 'Debug & Analysis',
    color: '#D97706',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 9 L3.5 4.5 L6 8 L8.5 3 L11 7 L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Programming',
    label: 'Programming',
    color: '#DB2777',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3 L2 7 L5 11 M9 3 L12 7 L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const CO_ABBR = {
  NVIDIA: 'NVDA', Intel: 'INTC', Qualcomm: 'QCOM', AMD: 'AMD',
  Apple: 'AAPL', Arm: 'ARM', Cadence: 'CDNS', Synopsys: 'SNPS',
  MediaTek: 'MTK', Broadcom: 'AVGO', Samsung: 'SMSN', TSMC: 'TSM',
  Marvell: 'MRVL', Micron: 'MU',
};

const DIFF_STYLE = {
  Easy:      { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
  Medium:    { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  Hard:      { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
  'Very Hard': { text: 'text-[#9333EA]', bg: 'bg-[#FAF5FF]', border: 'border-[#E9D5FF]' },
};

const ALL_COMPANIES = ['NVIDIA', 'Intel', 'Qualcomm', 'AMD', 'Arm', 'Cadence', 'Synopsys', 'Broadcom'];

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 rounded-full bg-[#F0F0F0] overflow-hidden mt-1.5">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export default function ProblemsPage() {
  const [problems, setProblems] = useState([]);
  const [solvedIds, setSolvedIds] = useState(new Set());
  const [domainSolved, setDomainSolved] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeDomain, setActiveDomain] = useState('all');
  const [diff, setDiff] = useState('All');
  const [activeCompany, setActiveCompany] = useState(null);
  const [searchInput, setSearchInput] = useState(''); // raw input (updates every keystroke)
  const [search, setSearch] = useState('');            // debounced (drives filter)
  const [hideSolved, setHideSolved] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [problemsRes, solvedRes] = await Promise.allSettled([
          axios.get(`${API}/api/problems`, { withCredentials: true }),
          axios.get(`${API}/api/stats/solved-problems`, { withCredentials: true }),
        ]);
        if (problemsRes.status === 'fulfilled') setProblems(problemsRes.value.data);
        if (solvedRes.status === 'fulfilled') {
          setSolvedIds(new Set(solvedRes.value.data.solved_ids || []));
          setDomainSolved(solvedRes.value.data.domain_solved || {});
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Debounce search input by 180ms for snappy feel without over-rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 180);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  const domainCounts = useMemo(() => {
    const counts = {};
    problems.forEach(p => { const d = p.domain || 'Uncategorized'; counts[d] = (counts[d] || 0) + 1; });
    return counts;
  }, [problems]);

  const filtered = useMemo(() => {
    return problems.filter(p => {
      if (activeDomain !== 'all' && p.domain !== activeDomain) return false;
      if (diff !== 'All' && p.difficulty !== diff) return false;
      if (activeCompany && !(p.companies || []).includes(activeCompany)) return false;
      if (hideSolved && solvedIds.has(p.problem_id)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) &&
            !(p.tags || []).some(t => t.toLowerCase().includes(q)) &&
            !(p.domain || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [problems, activeDomain, diff, activeCompany, hideSolved, search, solvedIds]);

  const totalSolved = solvedIds.size;
  const totalProblems = problems.length;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Left sidebar ────────────────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-[#EEEEEE] bg-[#FAFAFA] sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto">
          <div className="px-3 pt-5 pb-2">
            <p className="text-[9px] font-semibold tracking-[0.14em] text-[#AAAAAA] uppercase px-2 mb-2">
              Domains
            </p>
            {DOMAINS.map(domain => {
              const { id, label, color, Icon } = domain;
              const isActive = activeDomain === id;
              const total = id === 'all' ? totalProblems : (domainCounts[id] || 0);
              const solved = id === 'all' ? totalSolved : (domainSolved[id] || 0);

              return (
                <button
                  key={id}
                  onClick={() => setActiveDomain(id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg mb-0.5 transition-all group ${
                    isActive ? 'bg-white border border-[#E4E4E4] shadow-card' : 'hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: isActive ? color : '#CCCCCC' }} className="transition-colors shrink-0">
                      <Icon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium truncate transition-colors ${
                          isActive ? 'text-[#111111]' : 'text-[#888888] group-hover:text-[#444444]'
                        }`}>
                          {label}
                        </span>
                        {total > 0 && (
                          <span className={`text-[10px] font-mono ml-1 shrink-0 ${isActive ? 'text-[#888888]' : 'text-[#CCCCCC]'}`}>
                            {solved}/{total}
                          </span>
                        )}
                      </div>
                      {total > 0 && id !== 'all' && <ProgressBar value={solved} max={total} color={color} />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Difficulty filter */}
          <div className="px-3 mt-4 pb-5 border-t border-[#E8E8E8] pt-4">
            <p className="text-[9px] font-semibold tracking-[0.14em] text-[#AAAAAA] uppercase px-2 mb-2">
              Difficulty
            </p>
            {['All', 'Easy', 'Medium', 'Hard'].map(d => {
              const s = DIFF_STYLE[d] || {};
              const isActive = diff === d;
              const count = d === 'All'
                ? totalProblems
                : problems.filter(p => p.difficulty === d && (activeDomain === 'all' || p.domain === activeDomain)).length;
              return (
                <button
                  key={d}
                  onClick={() => setDiff(d)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg mb-0.5 flex items-center justify-between transition-colors ${
                    isActive ? 'bg-white border border-[#E4E4E4] shadow-card' : 'hover:bg-white/70'
                  }`}
                >
                  <span className={`text-xs font-medium ${isActive && d !== 'All' ? s.text : isActive ? 'text-[#111111]' : 'text-[#888888]'}`}>
                    {d}
                  </span>
                  <span className="text-[10px] font-mono text-[#CCCCCC]">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Page header */}
          <div className="px-6 pt-6 pb-4 border-b border-[#E8E8E8] bg-white">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h1 className="text-xl font-bold text-[#111111] tracking-tight">
                  {activeDomain === 'all' ? 'Problems' : DOMAINS.find(d => d.id === activeDomain)?.label}
                </h1>
                <p className="text-sm text-[#888888] mt-0.5">
                  {totalSolved > 0
                    ? `${totalSolved} of ${totalProblems} solved · ${Math.round((totalSolved / totalProblems) * 100)}% complete`
                    : `${totalProblems} problems available`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div
                    onClick={() => setHideSolved(h => !h)}
                    className={`w-8 h-4.5 rounded-full border transition-all relative cursor-pointer ${
                      hideSolved ? 'bg-[#111111] border-[#111111]' : 'bg-[#F0F0F0] border-[#E8E8E8]'
                    }`}
                    style={{ width: 32, height: 18 }}
                  >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm ${
                      hideSolved ? 'left-[14px]' : 'left-[2px]'
                    }`} />
                  </div>
                  <span className="text-xs text-[#888888] whitespace-nowrap font-medium">Hide solved</span>
                </label>
              </div>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
              <input
                type="text"
                placeholder="Search problems, tags, domains…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#E8E8E8] rounded-lg pl-9 pr-4 py-2 text-sm text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] transition-all"
              />
            </div>

            {/* Company chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-semibold tracking-widest text-[#AAAAAA] uppercase shrink-0 mr-1">Companies</span>
              <button
                onClick={() => setActiveCompany(null)}
                className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  activeCompany === null
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-[#E8E8E8] bg-[#FAFAFA] text-[#888888] hover:border-[#D0D0D0] hover:text-[#444444]'
                }`}
              >
                ALL
              </button>
              {ALL_COMPANIES.map(co => (
                <button
                  key={co}
                  onClick={() => setActiveCompany(activeCompany === co ? null : co)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                    activeCompany === co
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#E8E8E8] bg-[#FAFAFA] text-[#888888] hover:border-[#D0D0D0] hover:text-[#444444]'
                  }`}
                  title={co}
                >
                  {CO_ABBR[co] || co}
                </button>
              ))}
            </div>
          </div>

          {/* Problem table */}
          <div className="flex-1 overflow-auto bg-white">
            {loading ? (
              <div className="p-5 space-y-2">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-[#F5F5F5] animate-pulse" style={{ opacity: 1 - i * 0.08 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-11 h-11 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-4">
                  <Search className="w-5 h-5 text-[#CCCCCC]" />
                </div>
                <p className="text-[#888888] text-sm font-medium">No problems match your filters</p>
                <button
                  onClick={() => { setSearchInput(''); setSearch(''); setDiff('All'); setActiveCompany(null); setActiveDomain('all'); setHideSolved(false); }}
                  className="mt-3 text-xs text-[#555555] hover:text-[#111111] hover:underline font-medium transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA] sticky top-0 z-10">
                    <th className="px-5 py-3 text-left w-10">
                      <span className="text-[9px] font-semibold tracking-widest text-[#CCCCCC] uppercase">#</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-[9px] font-semibold tracking-widest text-[#CCCCCC] uppercase">Problem</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">
                      <span className="text-[9px] font-semibold tracking-widest text-[#CCCCCC] uppercase">Domain</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">
                      <span className="text-[9px] font-semibold tracking-widest text-[#CCCCCC] uppercase">Difficulty</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">
                      <span className="text-[9px] font-semibold tracking-widest text-[#CCCCCC] uppercase">Companies</span>
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => {
                    const solved = solvedIds.has(p.problem_id);
                    const dom = DOMAINS.find(d => d.id === p.domain);
                    const domColor = dom?.color || '#888888';
                    const ds = DIFF_STYLE[p.difficulty] || {};

                    return (
                      <tr
                        key={p.problem_id}
                        className="group border-b border-[#F5F5F5] hover:bg-[#F8F8F8] transition-all"
                      >
                        {/* Status */}
                        <td className="px-5 py-3.5 w-10">
                          {solved
                            ? <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                            : <Circle className="w-4 h-4 text-[#E0E0E0]" />
                          }
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5">
                          <Link
                            to={`/problems/${p.problem_id}`}
                            className={`text-sm font-medium transition-colors ${
                              solved ? 'text-[#AAAAAA] hover:text-[#888888]' : 'text-[#111111] hover:text-[#333333]'
                            }`}
                          >
                            <span className="text-[#CCCCCC] font-mono text-[11px] mr-2 tabular-nums">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            {p.title}
                          </Link>
                          <div className="flex flex-wrap gap-1 mt-1 md:hidden">
                            {(p.tags || []).slice(0, 2).map(t => (
                              <span key={t} className="text-[10px] text-[#AAAAAA] bg-[#F5F5F5] border border-[#EEEEEE] px-1.5 py-0.5 rounded font-mono">{t}</span>
                            ))}
                          </div>
                        </td>

                        {/* Domain */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {p.domain ? (
                            <button
                              onClick={() => setActiveDomain(p.domain)}
                              className="flex items-center gap-1.5 group/chip"
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: domColor }} />
                              <span className="text-xs text-[#888888] group-hover/chip:text-[#444444] whitespace-nowrap transition-colors">
                                {p.domain}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs text-[#DDDDDD]">—</span>
                          )}
                        </td>

                        {/* Difficulty */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          {p.difficulty && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ds.text} ${ds.bg} ${ds.border}`}>
                              {p.difficulty}
                            </span>
                          )}
                        </td>

                        {/* Companies */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            {(p.companies || []).slice(0, 3).map(co => (
                              <button
                                key={co}
                                onClick={() => setActiveCompany(activeCompany === co ? null : co)}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                  activeCompany === co
                                    ? 'border-[#111111] bg-[#111111] text-white'
                                    : 'border-[#E8E8E8] text-[#AAAAAA] hover:border-[#D0D0D0] hover:text-[#555555]'
                                }`}
                                title={co}
                              >
                                {CO_ABBR[co] || co}
                              </button>
                            ))}
                            {(p.companies || []).length > 3 && (
                              <span className="text-[10px] text-[#CCCCCC] font-mono">+{(p.companies || []).length - 3}</span>
                            )}
                          </div>
                        </td>

                        {/* Arrow */}
                        <td className="px-4 py-3.5">
                          <ChevronRight className="w-4 h-4 text-[#E0E0E0] group-hover:text-[#888888] transition-colors ml-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {!loading && filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-[#F0F0F0] bg-[#FAFAFA] flex items-center justify-between">
              <span className="text-xs text-[#AAAAAA]">
                {filtered.length} of {totalProblems} problems
              </span>
              {totalSolved > 0 && (
                <span className="text-xs text-[#AAAAAA]">
                  {Math.round((totalSolved / totalProblems) * 100)}% complete
                </span>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
