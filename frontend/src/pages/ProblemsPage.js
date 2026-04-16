import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import { Search, ChevronRight, CheckCircle2, Circle } from 'lucide-react';

// ─── Domain config — VLSI Forge palette ─────────────────────────────────────
const DOMAINS = [
  {
    id: 'all',
    label: 'All Problems',
    subtitle: 'Full problem bank',
    color: '#E8EDF4',
    accent: '#4A8FE8',
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
    subtitle: 'Circuits & modules',
    color: '#4A8FE8',
    accent: '#4A8FE8',
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
    subtitle: 'Testbenches & assertions',
    color: '#22C55E',
    accent: '#22C55E',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 7.5 L5.5 11 L12 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Computer Architecture',
    label: 'Computer Architecture',
    subtitle: 'Pipelines & memory',
    color: '#A855F7',
    accent: '#A855F7',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="5" y="5" width="4" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 1 V3 M9 1 V3 M5 11 V13 M9 11 V13 M1 5 H3 M1 9 H3 M11 5 H13 M11 9 H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'Debug & Analysis',
    label: 'Debug & Analysis',
    subtitle: 'Waveforms & bug hunts',
    color: '#F59E0B',
    accent: '#F59E0B',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 9 L3.5 4.5 L6 8 L8.5 3 L11 7 L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Programming',
    label: 'Programming',
    subtitle: 'C++ & algorithms',
    color: '#EC4899',
    accent: '#EC4899',
    Icon: () => (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3 L2 7 L5 11 M9 3 L12 7 L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

// Company abbreviation map
const CO_ABBR = {
  NVIDIA: 'NVDA', Intel: 'INTC', Qualcomm: 'QCOM', AMD: 'AMD',
  Apple: 'AAPL', Arm: 'ARM', Cadence: 'CDNS', Synopsys: 'SNPS',
  MediaTek: 'MTK', Broadcom: 'AVGO', Samsung: 'SMSN', TSMC: 'TSM',
  Marvell: 'MRVL', Micron: 'MU',
};

const DIFF_STYLE = {
  Easy: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25',
  Medium: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25',
  Hard: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25',
  'Very Hard': 'text-[#A855F7] bg-[#A855F7]/10 border-[#A855F7]/25',
};

const ALL_COMPANIES = [
  'NVIDIA', 'Intel', 'Qualcomm', 'AMD', 'Apple', 'Arm', 'Cadence', 'Synopsys', 'Broadcom',
];

// ─── Mini progress bar ───────────────────────────────────────────────────────
function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 rounded-full bg-[#1E2530] overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProblemsPage() {
  const [problems, setProblems] = useState([]);
  const [solvedIds, setSolvedIds] = useState(new Set());
  const [domainSolved, setDomainSolved] = useState({});
  const [loading, setLoading] = useState(true);

  const [activeDomain, setActiveDomain] = useState('all');
  const [diff, setDiff] = useState('All');
  const [activeCompany, setActiveCompany] = useState(null);
  const [search, setSearch] = useState('');
  const [hideSolved, setHideSolved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [problemsRes, solvedRes] = await Promise.allSettled([
          axios.get(`${API}/api/problems`, { withCredentials: true }),
          axios.get(`${API}/api/stats/solved-problems`, { withCredentials: true }),
        ]);
        if (problemsRes.status === 'fulfilled') {
          setProblems(problemsRes.value.data);
        }
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

  // Compute domain counts from problems list
  const domainCounts = useMemo(() => {
    const counts = {};
    problems.forEach(p => {
      const d = p.domain || 'Uncategorized';
      counts[d] = (counts[d] || 0) + 1;
    });
    return counts;
  }, [problems]);

  // Filtered problem list
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
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="flex" style={{ minHeight: 'calc(100vh - 56px)' }}>

        {/* ── Left sidebar — Domain Explorer ─────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-56 xl:w-60 shrink-0 border-r border-[#1E2530] bg-[#0D1117] sticky top-[56px] h-[calc(100vh-56px)] overflow-y-auto">
          <div className="px-3 pt-5 pb-2">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-[#4A5568] uppercase px-2 mb-3">
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
                  className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-all group ${
                    isActive
                      ? 'bg-[#13171E] border border-[#1E2530]'
                      : 'hover:bg-[#13171E]/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: isActive ? color : '#4A5568' }} className="transition-colors group-hover:text-current shrink-0">
                      <Icon />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium truncate transition-colors ${
                          isActive ? 'text-[#E8EDF4]' : 'text-[#7A8FA8] group-hover:text-[#C8D4E0]'
                        }`}>
                          {label}
                        </span>
                        {total > 0 && (
                          <span className={`text-[10px] font-mono ml-1 shrink-0 ${
                            isActive ? 'text-[#7A8FA8]' : 'text-[#4A5568]'
                          }`}>
                            {solved}/{total}
                          </span>
                        )}
                      </div>
                      {total > 0 && id !== 'all' && (
                        <ProgressBar value={solved} max={total} color={color} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider + Difficulty Quick Filter */}
          <div className="px-3 mt-4 pb-5 border-t border-[#1E2530] pt-4">
            <p className="text-[9px] font-semibold tracking-[0.12em] text-[#4A5568] uppercase px-2 mb-2">
              Difficulty
            </p>
            {['All', 'Easy', 'Medium', 'Hard'].map(d => {
              const color = d === 'Easy' ? '#22C55E' : d === 'Medium' ? '#F59E0B' : d === 'Hard' ? '#EF4444' : '#E8EDF4';
              const count = d === 'All' ? totalProblems : problems.filter(p => p.difficulty === d && (activeDomain === 'all' || p.domain === activeDomain)).length;
              return (
                <button
                  key={d}
                  onClick={() => setDiff(d)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg mb-0.5 flex items-center justify-between transition-colors ${
                    diff === d ? 'bg-[#13171E]' : 'hover:bg-[#13171E]/60'
                  }`}
                >
                  <span className="text-xs" style={{ color: diff === d ? color : '#7A8FA8' }}>{d}</span>
                  <span className="text-[10px] font-mono text-[#4A5568]">{count}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Main content ────────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Page header */}
          <div className="px-6 pt-7 pb-4 border-b border-[#1E2530]">
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                {/* Domain breadcrumb */}
                <div className="flex items-center gap-1.5 mb-1">
                  {activeDomain !== 'all' && (
                    <>
                      <button onClick={() => setActiveDomain('all')} className="text-xs text-[#4A5568] hover:text-[#7A8FA8] transition-colors">All</button>
                      <span className="text-[#2A3240] text-xs">/</span>
                    </>
                  )}
                  <span className="text-xs font-medium" style={{
                    color: DOMAINS.find(d => d.id === activeDomain)?.color || '#E8EDF4'
                  }}>
                    {DOMAINS.find(d => d.id === activeDomain)?.label || 'All Problems'}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-[#E8EDF4] tracking-tight">
                  {activeDomain === 'all'
                    ? 'Problems'
                    : DOMAINS.find(d => d.id === activeDomain)?.label}
                </h1>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  {DOMAINS.find(d => d.id === activeDomain)?.subtitle}
                </p>
              </div>

              {/* Stat chips */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-[#7A8FA8] bg-[#13171E] border border-[#1E2530] rounded-lg px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]"></span>
                  {totalSolved} solved
                </span>
                <span className="text-xs text-[#7A8FA8] bg-[#13171E] border border-[#1E2530] rounded-lg px-3 py-1.5">
                  {totalProblems} total
                </span>
              </div>
            </div>

            {/* Search + company chips */}
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4A5568]" />
                <input
                  type="text"
                  placeholder="Search by title, tag, or domain..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[#0D1117] border border-[#1E2530] rounded-lg pl-9 pr-4 py-2 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8]/50 transition-colors"
                />
              </div>

              {/* Company filter + hide solved */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold tracking-widest text-[#4A5568] uppercase shrink-0">Companies</span>
                <button
                  onClick={() => setActiveCompany(null)}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                    activeCompany === null
                      ? 'border-[#4A8FE8]/40 bg-[#4A8FE8]/10 text-[#4A8FE8]'
                      : 'border-[#1E2530] bg-[#0D1117] text-[#4A5568] hover:text-[#7A8FA8]'
                  }`}
                >
                  ALL
                </button>
                {ALL_COMPANIES.map(co => (
                  <button
                    key={co}
                    onClick={() => setActiveCompany(activeCompany === co ? null : co)}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-md border transition-colors ${
                      activeCompany === co
                        ? 'border-[#4A8FE8]/40 bg-[#4A8FE8]/10 text-[#4A8FE8]'
                        : 'border-[#1E2530] bg-[#0D1117] text-[#4A5568] hover:text-[#7A8FA8] hover:border-[#2A3240]'
                    }`}
                  >
                    {CO_ABBR[co] || co}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div
                      onClick={() => setHideSolved(h => !h)}
                      className={`w-7 h-4 rounded-full border transition-colors relative cursor-pointer ${
                        hideSolved
                          ? 'bg-[#22C55E]/20 border-[#22C55E]/40'
                          : 'bg-[#0D1117] border-[#1E2530]'
                      }`}
                    >
                      <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
                        hideSolved ? 'left-3.5 bg-[#22C55E]' : 'left-0.5 bg-[#4A5568]'
                      }`} />
                    </div>
                    <span className="text-[11px] text-[#4A5568] whitespace-nowrap">Hide solved</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Problem table */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="p-6 space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-11 rounded-lg bg-[#13171E] animate-pulse" style={{ opacity: 1 - i * 0.1 }} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-12 h-12 rounded-full bg-[#13171E] border border-[#1E2530] flex items-center justify-center mb-4">
                  <Search className="w-5 h-5 text-[#4A5568]" />
                </div>
                <p className="text-[#7A8FA8] text-sm font-medium">No problems match your filters</p>
                <button
                  onClick={() => { setSearch(''); setDiff('All'); setActiveCompany(null); setActiveDomain('all'); setHideSolved(false); }}
                  className="mt-3 text-xs text-[#4A8FE8] hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1E2530] bg-[#0D1117] sticky top-0 z-10">
                    <th className="px-4 py-3 text-left w-8">
                      <span className="text-[10px] font-semibold tracking-widest text-[#4A5568] uppercase">#</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-[10px] font-semibold tracking-widest text-[#4A5568] uppercase">Problem</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">
                      <span className="text-[10px] font-semibold tracking-widest text-[#4A5568] uppercase">Domain</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">
                      <span className="text-[10px] font-semibold tracking-widest text-[#4A5568] uppercase">Difficulty</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">
                      <span className="text-[10px] font-semibold tracking-widest text-[#4A5568] uppercase">Companies</span>
                    </th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#0F1419]">
                  {filtered.map((p, idx) => {
                    const solved = solvedIds.has(p.problem_id);
                    const dom = DOMAINS.find(d => d.id === p.domain);
                    const domColor = dom?.color || '#4A5568';

                    return (
                      <tr
                        key={p.problem_id}
                        className={`group transition-colors ${
                          solved ? 'hover:bg-[#0F1A14]' : 'hover:bg-[#0D1117]'
                        }`}
                      >
                        {/* # + solved indicator */}
                        <td className="px-4 py-3.5 w-10">
                          <div className="flex items-center gap-2">
                            {solved
                              ? <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
                              : <Circle className="w-3.5 h-3.5 text-[#2A3240] shrink-0" />
                            }
                          </div>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5">
                          <Link
                            to={`/problems/${p.problem_id}`}
                            className={`text-sm font-medium transition-colors ${
                              solved
                                ? 'text-[#4A5568] hover:text-[#7A8FA8]'
                                : 'text-[#C8D4E0] hover:text-[#E8EDF4]'
                            }`}
                          >
                            <span className="text-[#4A5568] mr-2 font-mono text-xs">{String(idx + 1).padStart(2, '0')}.</span>
                            {p.title}
                          </Link>
                          {/* Tags — shown on small screens */}
                          <div className="flex flex-wrap gap-1 mt-1 md:hidden">
                            {(p.tags || []).slice(0, 2).map(t => (
                              <span key={t} className="text-[10px] text-[#4A5568] bg-[#13171E] border border-[#1E2530] px-1.5 py-0.5 rounded font-mono">{t}</span>
                            ))}
                          </div>
                        </td>

                        {/* Domain chip */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          {p.domain ? (
                            <button
                              onClick={() => setActiveDomain(p.domain)}
                              className="flex items-center gap-1.5 group/chip"
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: domColor }} />
                              <span className="text-xs whitespace-nowrap transition-colors group-hover/chip:opacity-100 opacity-60" style={{ color: domColor }}>
                                {p.domain}
                              </span>
                            </button>
                          ) : (
                            <span className="text-xs text-[#2A3240]">—</span>
                          )}
                        </td>

                        {/* Difficulty */}
                        <td className="px-4 py-3.5 hidden sm:table-cell">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${DIFF_STYLE[p.difficulty] || ''}`}>
                            {p.difficulty}
                          </span>
                        </td>

                        {/* Company tickers */}
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <div className="flex items-center gap-1">
                            {(p.companies || []).slice(0, 3).map(co => (
                              <button
                                key={co}
                                onClick={() => setActiveCompany(activeCompany === co ? null : co)}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                                  activeCompany === co
                                    ? 'border-[#4A8FE8]/40 bg-[#4A8FE8]/10 text-[#4A8FE8]'
                                    : 'border-[#1E2530] text-[#4A5568] hover:border-[#2A3240] hover:text-[#7A8FA8]'
                                }`}
                                title={co}
                              >
                                {CO_ABBR[co] || co}
                              </button>
                            ))}
                            {(p.companies || []).length > 3 && (
                              <span className="text-[10px] text-[#4A5568] font-mono">+{(p.companies || []).length - 3}</span>
                            )}
                          </div>
                        </td>

                        {/* Arrow */}
                        <td className="px-4 py-3.5">
                          <ChevronRight className="w-4 h-4 text-[#1E2530] group-hover:text-[#4A8FE8] transition-colors ml-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-[#1E2530] flex items-center justify-between">
              <span className="text-xs text-[#4A5568]">
                Showing {filtered.length} of {totalProblems} problems
              </span>
              <span className="text-xs text-[#4A5568]">
                {totalSolved > 0 && `${Math.round((totalSolved / totalProblems) * 100)}% complete`}
              </span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
