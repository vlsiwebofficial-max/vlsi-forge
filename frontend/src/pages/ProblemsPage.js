import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { API } from '../App';
import { cachedGet } from '../utils/apiCache';
import Navbar from '../components/Navbar';
import { Search, ChevronRight, CheckCircle2, Circle, ChevronLeft } from 'lucide-react';

// ─── Domain config (no "All" — topics are first-class) ──────────────────────
const DOMAINS = [
  {
    id: 'RTL Design',
    label: 'RTL Design',
    desc: 'Write synthesizable RTL for combinational and sequential circuits',
    color: '#2563EB',
    bg: '#EFF6FF',
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M2 11 H6 V6 H16 V16 H6 V11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 8.5 H20 M16 13.5 H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'Design Verification',
    label: 'Design Verification',
    desc: 'Write testbenches, assertions and coverage for RTL modules',
    color: '#16A34A',
    bg: '#F0FDF4',
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M3 11.5 L8.5 17 L19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Computer Architecture',
    label: 'Computer Architecture',
    desc: 'Pipelines, caches, memory hierarchies and processor design',
    color: '#9333EA',
    bg: '#FAF5FF',
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="5" y="5" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
        <rect x="8" y="8" width="6" height="6" rx="0.75" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 2V5M14 2V5M8 17V20M14 17V20M2 8H5M2 14H5M17 8H20M17 14H20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'Debug & Analysis',
    label: 'Debug & Analysis',
    desc: 'Find and fix bugs in broken RTL — waveforms and timing analysis',
    color: '#D97706',
    bg: '#FFFBEB',
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M2 14 L5.5 7 L9 13 L13 4 L17 11 L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Programming',
    label: 'Programming',
    desc: 'EDA scripting, automation and toolchain programming',
    color: '#DB2777',
    bg: '#FFF0F7',
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M8 5 L3 11 L8 17 M14 5 L19 11 L14 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'Timing & Power',
    label: 'Timing & Power',
    desc: 'Static timing analysis, clock domains and low-power design',
    color: '#0891B2',
    bg: '#ECFEFF',
    Icon: () => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
        <path d="M11 7V11L14 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
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
  Easy:       { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
  Medium:     { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  Hard:       { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
  'Very Hard':{ text: 'text-[#9333EA]', bg: 'bg-[#FAF5FF]', border: 'border-[#E9D5FF]' },
};

const ALL_COMPANIES = ['NVIDIA','Intel','Qualcomm','AMD','Arm','Cadence','Synopsys','Broadcom'];

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-1 rounded-full bg-[#EEEEEE] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

// ─── Topic folder card (landing view) ────────────────────────────────────────
function TopicCard({ domain, total, solved, onClick }) {
  const { label, desc, color, bg, Icon } = domain;
  const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white border border-[#E8E8E8] rounded-2xl p-5 shadow-card shadow-card-hover flex flex-col gap-4 transition-all"
    >
      {/* Icon + arrow */}
      <div className="flex items-start justify-between">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all" style={{ background: bg, color }}>
          <Icon />
        </div>
        <ChevronRight className="w-4 h-4 text-[#DDDDDD] group-hover:text-[#888888] group-hover:translate-x-0.5 transition-all mt-1" />
      </div>

      {/* Text */}
      <div className="flex-1">
        <h3 className="font-bold text-[#111111] text-[15px] tracking-tight leading-snug mb-1">
          {label}
        </h3>
        <p className="text-xs text-[#888888] leading-relaxed line-clamp-2">{desc}</p>
      </div>

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#AAAAAA] font-medium">
            {total > 0 ? `${solved} / ${total} solved` : 'Coming soon'}
          </span>
          {total > 0 && (
            <span className="text-xs font-bold" style={{ color: pct === 100 ? '#16A34A' : color }}>
              {pct}%
            </span>
          )}
        </div>
        {total > 0 && <ProgressBar value={solved} max={total} color={color} />}
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProblemsPage() {
  const [problems,     setProblems]     = useState([]);
  const [solvedIds,    setSolvedIds]    = useState(new Set());
  const [domainSolved, setDomainSolved] = useState({});
  const [loading,      setLoading]      = useState(true);

  // null = folder landing view; string = drilled into a specific domain
  const [activeDomain,  setActiveDomain]  = useState(null);
  const [diff,          setDiff]          = useState('All');
  const [activeCompany, setActiveCompany] = useState(null);
  const [searchInput,   setSearchInput]   = useState('');
  const [search,        setSearch]        = useState('');
  const [hideSolved,    setHideSolved]    = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [problemsRes, solvedRes] = await Promise.allSettled([
          cachedGet(`${API}/api/problems`,               { withCredentials: true }),
          cachedGet(`${API}/api/stats/solved-problems`,  { withCredentials: true }),
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

  // 180ms debounce on search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(searchInput), 180);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // Reset filters when switching domains
  const openDomain = (id) => {
    setActiveDomain(id);
    setDiff('All');
    setActiveCompany(null);
    setSearchInput('');
    setSearch('');
    setHideSolved(false);
  };

  const backToTopics = () => {
    setActiveDomain(null);
    setDiff('All');
    setActiveCompany(null);
    setSearchInput('');
    setSearch('');
  };

  const domainCounts = useMemo(() => {
    const c = {};
    problems.forEach(p => { const d = p.domain || 'Uncategorized'; c[d] = (c[d] || 0) + 1; });
    return c;
  }, [problems]);

  const filtered = useMemo(() => {
    if (!activeDomain) return [];
    return problems.filter(p => {
      if (p.domain !== activeDomain) return false;
      if (diff !== 'All' && p.difficulty !== diff) return false;
      if (activeCompany && !(p.companies || []).includes(activeCompany)) return false;
      if (hideSolved && solvedIds.has(p.problem_id)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) &&
            !(p.tags || []).some(t => t.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [problems, activeDomain, diff, activeCompany, hideSolved, search, solvedIds]);

  const activeDomainCfg = DOMAINS.find(d => d.id === activeDomain);
  const totalSolved   = solvedIds.size;
  const totalProblems = problems.length;

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="h-6 w-48 rounded-lg shimmer mb-2" />
        <div className="h-4 w-64 rounded-lg shimmer mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 rounded-2xl shimmer" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );

  // ── FOLDER LANDING VIEW ───────────────────────────────────────────────────
  if (!activeDomain) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#BBBBBB] uppercase mb-1.5">Problems</p>
          <h1 className="text-[26px] font-extrabold text-[#111111] tracking-tight">Choose a topic</h1>
          <p className="text-sm text-[#888888] mt-1">
            {totalSolved > 0
              ? `${totalSolved} of ${totalProblems} problems solved across all topics`
              : `${totalProblems} problems across ${DOMAINS.filter(d => domainCounts[d.id]).length} topics`}
          </p>
        </div>

        {/* Overall progress bar */}
        {totalProblems > 0 && (
          <div className="mb-8 bg-white border border-[#E8E8E8] rounded-2xl p-4 shadow-card animate-fade-up">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-[#111111]">Overall progress</span>
              <span className="text-sm font-bold text-[#111111]">{Math.round((totalSolved / totalProblems) * 100)}%</span>
            </div>
            <ProgressBar value={totalSolved} max={totalProblems} color="#111111" />
            <p className="text-xs text-[#AAAAAA] mt-1.5">{totalSolved} / {totalProblems} solved</p>
          </div>
        )}

        {/* Topic folder grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger animate-fade-up">
          {DOMAINS.map(domain => (
            <TopicCard
              key={domain.id}
              domain={domain}
              total={domainCounts[domain.id] || 0}
              solved={domainSolved[domain.id] || 0}
              onClick={() => openDomain(domain.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // ── DOMAIN DRILL-DOWN VIEW ────────────────────────────────────────────────
  const domainColor  = activeDomainCfg?.color  || '#111111';
  const domainBg     = activeDomainCfg?.bg     || '#F5F5F5';
  const domainTotal  = domainCounts[activeDomain] || 0;
  const domainSolvedCount = domainSolved[activeDomain] || 0;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="flex" style={{ minHeight: 'calc(100vh - 58px)' }}>

        {/* ── Left sidebar: topic switcher ──────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-52 xl:w-56 shrink-0 border-r border-[#EEEEEE] bg-[#FAFAFA] sticky top-[58px] h-[calc(100vh-58px)] overflow-y-auto">
          <div className="px-3 pt-5 pb-5">

            {/* Back to topics */}
            <button
              onClick={backToTopics}
              className="flex items-center gap-1.5 text-xs text-[#888888] hover:text-[#111111] font-medium mb-4 px-2 py-1 rounded-lg hover:bg-white transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              All Topics
            </button>

            <p className="text-[9px] font-bold tracking-[0.14em] text-[#AAAAAA] uppercase px-2 mb-2">Topics</p>

            {DOMAINS.map(domain => {
              const isActive = activeDomain === domain.id;
              const total  = domainCounts[domain.id] || 0;
              const solved = domainSolved[domain.id] || 0;
              if (!total) return null; // hide empty topics in sidebar
              return (
                <button
                  key={domain.id}
                  onClick={() => openDomain(domain.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl mb-0.5 transition-all group ${
                    isActive ? 'bg-white border border-[#E4E4E4] shadow-card' : 'hover:bg-white/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0 transition-colors"
                      style={{ background: isActive ? domain.color : '#DDDDDD' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium truncate ${
                          isActive ? 'text-[#111111]' : 'text-[#888888] group-hover:text-[#444444]'
                        }`}>
                          {domain.label}
                        </span>
                        <span className={`text-[10px] font-mono shrink-0 ml-1 ${isActive ? 'text-[#888888]' : 'text-[#CCCCCC]'}`}>
                          {solved}/{total}
                        </span>
                      </div>
                      <ProgressBar value={solved} max={total} color={domain.color} />
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Difficulty filter */}
            <div className="mt-5 pt-4 border-t border-[#E8E8E8]">
              <p className="text-[9px] font-bold tracking-[0.14em] text-[#AAAAAA] uppercase px-2 mb-2">Difficulty</p>
              {['All', 'Easy', 'Medium', 'Hard'].map(d => {
                const s = DIFF_STYLE[d] || {};
                const isActive = diff === d;
                const count = d === 'All'
                  ? domainTotal
                  : problems.filter(p => p.domain === activeDomain && p.difficulty === d).length;
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
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col min-w-0">

          {/* Domain header */}
          <div className="px-6 pt-5 pb-4 border-b border-[#E8E8E8] bg-white">

            {/* Breadcrumb */}
            <button
              onClick={backToTopics}
              className="flex items-center gap-1 text-xs text-[#AAAAAA] hover:text-[#555555] font-medium mb-3 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              All Topics
            </button>

            <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
              <div className="flex items-center gap-3">
                {/* Domain colour dot */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: domainBg, color: domainColor }}>
                  {activeDomainCfg && <activeDomainCfg.Icon />}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-[#111111] tracking-tight">{activeDomain}</h1>
                  <p className="text-sm text-[#888888] mt-0.5">
                    {domainSolvedCount} of {domainTotal} solved
                    {domainTotal > 0 && ` · ${Math.round((domainSolvedCount / domainTotal) * 100)}% complete`}
                  </p>
                </div>
              </div>

              {/* Hide solved toggle */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setHideSolved(h => !h)}
                  className="relative cursor-pointer"
                  style={{ width: 32, height: 18 }}
                >
                  <div className={`w-full h-full rounded-full border transition-all ${
                    hideSolved ? 'bg-[#111111] border-[#111111]' : 'bg-[#F0F0F0] border-[#E8E8E8]'
                  }`} />
                  <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm ${
                    hideSolved ? 'left-[14px]' : 'left-[2px]'
                  }`} />
                </div>
                <span className="text-xs text-[#888888] whitespace-nowrap font-medium">Hide solved</span>
              </label>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#CCCCCC]" />
              <input
                type="text"
                placeholder={`Search in ${activeDomain}…`}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                className="w-full bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl pl-9 pr-4 py-2 text-sm text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#111111] focus:ring-1 focus:ring-[#111111] transition-all"
              />
            </div>

            {/* Company chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-bold tracking-widest text-[#AAAAAA] uppercase shrink-0 mr-1">Companies</span>
              <button
                onClick={() => setActiveCompany(null)}
                className={`text-[11px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  activeCompany === null
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-[#E8E8E8] bg-[#FAFAFA] text-[#888888] hover:border-[#D0D0D0] hover:text-[#444444]'
                }`}
              >ALL</button>
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
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 text-center">
                <div className="w-11 h-11 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-4">
                  <Search className="w-5 h-5 text-[#CCCCCC]" />
                </div>
                <p className="text-[#888888] text-sm font-medium">No problems match your filters</p>
                <button
                  onClick={() => { setSearchInput(''); setSearch(''); setDiff('All'); setActiveCompany(null); setHideSolved(false); }}
                  className="mt-3 text-xs text-[#555555] hover:text-[#111111] hover:underline font-medium"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA] sticky top-0 z-10">
                    <th className="px-5 py-3 text-left w-10">
                      <span className="text-[9px] font-bold tracking-widest text-[#CCCCCC] uppercase">#</span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-[9px] font-bold tracking-widest text-[#CCCCCC] uppercase">Problem</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden sm:table-cell">
                      <span className="text-[9px] font-bold tracking-widest text-[#CCCCCC] uppercase">Difficulty</span>
                    </th>
                    <th className="px-4 py-3 text-left hidden lg:table-cell">
                      <span className="text-[9px] font-bold tracking-widest text-[#CCCCCC] uppercase">Companies</span>
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, idx) => {
                    const solved = solvedIds.has(p.problem_id);
                    const ds = DIFF_STYLE[p.difficulty] || {};
                    return (
                      <tr
                        key={p.problem_id}
                        className="group border-b border-[#F5F5F5] hover:bg-[#F8F8F8] transition-colors"
                      >
                        {/* Status */}
                        <td className="px-5 py-3.5 w-10">
                          {solved
                            ? <CheckCircle2 className="w-4 h-4 text-[#16A34A]" />
                            : <Circle className="w-4 h-4 text-[#E0E0E0]" />}
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3.5">
                          <Link
                            to={`/problems/${p.problem_id}`}
                            className={`text-sm font-medium transition-colors ${
                              solved ? 'text-[#AAAAAA] hover:text-[#888888]' : 'text-[#111111] hover:text-[#444444]'
                            }`}
                          >
                            <span className="text-[#CCCCCC] font-mono text-[11px] mr-2 tabular-nums">
                              {String(idx + 1).padStart(2, '0')}.
                            </span>
                            {p.title}
                          </Link>
                          {/* Tags — mobile only */}
                          {(p.tags || []).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 sm:hidden">
                              {(p.tags || []).slice(0, 2).map(t => (
                                <span key={t} className="text-[10px] text-[#AAAAAA] bg-[#F5F5F5] border border-[#EEEEEE] px-1.5 py-0.5 rounded font-mono">{t}</span>
                              ))}
                            </div>
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
                          <ChevronRight className="w-4 h-4 text-[#E0E0E0] group-hover:text-[#888888] group-hover:translate-x-0.5 transition-all ml-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-[#F0F0F0] bg-[#FAFAFA] flex items-center justify-between">
              <span className="text-xs text-[#AAAAAA]">{filtered.length} problems</span>
              {domainSolvedCount > 0 && (
                <span className="text-xs text-[#AAAAAA]">
                  {Math.round((domainSolvedCount / domainTotal) * 100)}% of topic complete
                </span>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
