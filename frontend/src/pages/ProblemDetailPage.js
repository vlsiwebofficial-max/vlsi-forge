import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import Editor from '@monaco-editor/react';
import {
  Play, ChevronLeft, CheckCircle, XCircle, AlertCircle,
  Loader2, Download, ChevronDown, ZoomIn, ZoomOut,
  Clock, CheckCircle2, Circle,
} from 'lucide-react';

const DIFF_STYLE = {
  Easy:   { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
  Medium: { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  Hard:   { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
};

const LANGUAGES = [
  { value: 'verilog',       label: 'Verilog',      monacoLang: 'verilog', disabled: false },
  { value: 'systemverilog', label: 'SystemVerilog', monacoLang: 'verilog', disabled: false },
  { value: 'vhdl',          label: 'VHDL',          monacoLang: 'vhdl',   disabled: false },
];

const DEFAULT_CODE = {
  verilog: `// Write your Verilog code here
module solution(
  // Define your ports
);
  // Your implementation
endmodule`,
  systemverilog: `// Write your SystemVerilog code here
module solution(
  // Define your ports
);
  // Your implementation
endmodule`,
  vhdl: `-- Write your VHDL code here
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

entity solution is
  port (
    -- Define your ports
  );
end solution;

architecture Behavioral of solution is
begin
  -- Your implementation
end Behavioral;`,
};

// ─── Waveform Viewer ──────────────────────────────────────────────────────────
const WAVEFORM_COLORS = ['#2563EB','#16A34A','#D97706','#9333EA','#DB2777','#0891B2','#EA580C','#64748B'];

function WaveformViewer({ data }) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  if (!data?.signals || !Object.keys(data.signals).length) return (
    <div className="flex items-center justify-center py-6 text-[#AAAAAA] text-xs">No waveform data</div>
  );
  const signals = Object.entries(data.signals);
  const maxTime = data.max_time || 1;
  const timescale = data.timescale || '1ns';
  const LABEL_W = 80, ROW_H = 28, SIG_H = 18, Y_PAD = (ROW_H - SIG_H) / 2, TICK_COUNT = 8;
  const totalW = Math.max(400, (containerRef.current?.clientWidth || 600) - LABEL_W - 24);
  const scaledW = totalW * zoom;
  const totalH = signals.length * ROW_H + 24;
  const tx = t => (t / maxTime) * scaledW;
  function buildPath(pts) {
    if (!pts?.length) return '';
    const s = [];
    for (let i = 0; i < pts.length; i++) {
      const [t, v] = pts[i];
      const nxt = i + 1 < pts.length ? pts[i+1][0] : maxTime;
      const hi = v==='1'||v===1||v==='H'||v==='h';
      const y = hi ? Y_PAD : Y_PAD + SIG_H;
      if (i===0) s.push(`M ${tx(t)} ${y}`); else s.push(`V ${y}`);
      s.push(`H ${tx(nxt)}`);
    }
    return s.join(' ');
  }
  const ti = maxTime / TICK_COUNT;
  return (
    <div className="rounded-xl overflow-hidden border border-[#E8E8E8] bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8E8E8] bg-[#FAFAFA]">
        <span className="text-xs font-semibold text-[#111111]">Waveform</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#888888] mr-2">Timescale: {timescale}</span>
          <button onClick={() => setZoom(z => Math.max(0.5, z-0.5))} className="p-1 rounded text-[#888888] hover:text-[#111111] hover:bg-[#F0F0F0]"><ZoomOut className="w-3.5 h-3.5"/></button>
          <button onClick={() => setZoom(z => Math.min(8, z+0.5))} className="p-1 rounded text-[#888888] hover:text-[#111111] hover:bg-[#F0F0F0]"><ZoomIn className="w-3.5 h-3.5"/></button>
          <span className="text-xs text-[#555555] ml-1 w-8 text-right font-mono">{zoom}×</span>
        </div>
      </div>
      <div className="overflow-x-auto" ref={containerRef}>
        <div style={{display:'flex',minWidth:'100%'}}>
          <div style={{width:LABEL_W,flexShrink:0}}>
            <div style={{height:20}}/>
            {signals.map(([n],i) => <div key={n} style={{height:ROW_H,display:'flex',alignItems:'center',paddingLeft:8}}><span className="text-xs font-mono truncate" style={{color:WAVEFORM_COLORS[i%WAVEFORM_COLORS.length]}} title={n}>{n}</span></div>)}
          </div>
          <div style={{flex:1,overflowX:zoom>1?'auto':'visible'}}>
            <svg width={scaledW} height={totalH} style={{display:'block'}}>
              {Array.from({length:TICK_COUNT+1},(_,i)=><line key={i} x1={tx(i*ti)} y1={20} x2={tx(i*ti)} y2={totalH} stroke="#F0F0F0" strokeWidth="1"/>)}
              {Array.from({length:TICK_COUNT+1},(_,i)=><g key={i}><line x1={tx(i*ti)} y1={14} x2={tx(i*ti)} y2={20} stroke="#CCCCCC" strokeWidth="1"/><text x={tx(i*ti)} y={10} textAnchor="middle" fontSize="8" fill="#CCCCCC">{i*ti}</text></g>)}
              {signals.map(([n,pts],i)=>{const c=WAVEFORM_COLORS[i%WAVEFORM_COLORS.length],p=buildPath(pts);return(<g key={n} transform={`translate(0,${20+i*ROW_H})`}><rect x={0} y={0} width={scaledW} height={ROW_H} fill="transparent"/>{p&&<path d={p} stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round"/>}{pts?.map(([t,v],pi)=>{const nxt=pi+1<pts.length?pts[pi+1][0]:maxTime,sw=tx(nxt)-tx(t);if(sw<16)return null;const hi=v==='1'||v===1||v==='H'||v==='h';return<text key={pi} x={tx(t)+sw/2} y={hi?Y_PAD-1:Y_PAD+SIG_H+8} textAnchor="middle" fontSize="7" fill={c} opacity="0.6">{String(v)}</text>})}</g>);})}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status pill ──────────────────────────────────────────────────────────────
const STATUS = {
  passed: { icon: <CheckCircle2 className="w-3.5 h-3.5"/>, text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]', label: 'Passed' },
  failed: { icon: <XCircle      className="w-3.5 h-3.5"/>, text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]', label: 'Failed' },
  error:  { icon: <AlertCircle  className="w-3.5 h-3.5"/>, text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', label: 'Error'  },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProblemDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [problem,    setProblem]    = useState(null);
  const [code,       setCode]       = useState('');
  const [language,   setLanguage]   = useState('verilog');
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState(null);
  const [activeTab,  setActiveTab]  = useState('description');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [saveStatus,   setSaveStatus]   = useState(null);
  const [history,      setHistory]      = useState(null); // null = not loaded yet

  // Panel resize state
  const [leftPct,   setLeftPct]   = useState(42); // % width of left panel
  const isDragging  = useRef(false);
  const dragStartX  = useRef(0);
  const dragStartPct = useRef(42);
  const containerRef = useRef(null);

  const saveTimerRef           = useRef(null);
  const savedIndicatorTimerRef = useRef(null);
  const langRef                = useRef(language);
  const submitRef              = useRef(null);

  useEffect(() => { langRef.current = language; }, [language]);

  // ── Auto-save ──────────────────────────────────────────────────────────────
  const saveCode = useCallback(async (codeToSave, langToSave) => {
    if (!id) return;
    setSaveStatus('saving');
    try {
      await axios.put(`${API}/api/user-code/${id}`, { code: codeToSave, language: langToSave }, { withCredentials: true });
      setSaveStatus('saved');
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch { setSaveStatus(null); }
  }, [id]);

  useEffect(() => () => {
    if (saveTimerRef.current)           clearTimeout(saveTimerRef.current);
    if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
  }, []);

  // ── Load problem + saved code ──────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      axios.get(`${API}/api/problems/${id}`, { withCredentials: true }),
      axios.get(`${API}/api/user-code/${id}`, { withCredentials: true }),
    ]).then(([pR, cR]) => {
      if (pR.status === 'rejected') { navigate('/problems'); return; }
      const prob = pR.value.data;
      setProblem(prob);
      if (cR.status === 'fulfilled' && cR.value.data?.code) {
        setCode(cR.value.data.code);
        if (cR.value.data.language) { setLanguage(cR.value.data.language); langRef.current = cR.value.data.language; }
      } else {
        setCode(prob.starter_code || DEFAULT_CODE.verilog);
      }
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  // ── Load history when that tab is first opened ─────────────────────────────
  useEffect(() => {
    if (activeTab === 'history' && history === null) {
      axios.get(`${API}/api/submissions/problem/${id}`, { withCredentials: true })
        .then(r => setHistory(r.data))
        .catch(() => setHistory([]));
    }
  }, [activeTab, id, history]);

  const handleCodeChange = useCallback((val) => {
    const c = val || '';
    setCode(c);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveCode(c, langRef.current), 2500);
  }, [saveCode]);

  const handleLanguageChange = (lang) => {
    setLanguage(lang); langRef.current = lang; setLangMenuOpen(false);
    const isDefault = Object.values(DEFAULT_CODE).some(d => code.trim() === d.trim());
    if (isDefault) setCode(problem?.starter_code || DEFAULT_CODE[lang]);
  };

  const handleSubmit = useCallback(async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    saveCode(code, language);
    setSubmitting(true); setResult(null); setActiveTab('result');
    try {
      const res = await axios.post(`${API}/api/submissions`, { problem_id: id, code, language }, { withCredentials: true });
      setResult(res.data);
      setHistory(null); // invalidate history cache so it reloads next time
    } catch (err) {
      setResult({ status: 'error', compilation_error: err.response?.data?.detail || 'Submission failed.' });
    } finally {
      setSubmitting(false);
    }
  }, [id, code, language, saveCode]);

  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  // ── Ctrl+Enter ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!submitting) submitRef.current?.(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [submitting]);

  // ── Draggable panel resize ─────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    isDragging.current   = true;
    dragStartX.current   = e.clientX;
    dragStartPct.current = leftPct;

    const onMove = (ev) => {
      if (!isDragging.current || !containerRef.current) return;
      const totalW = containerRef.current.offsetWidth;
      const delta  = ev.clientX - dragStartX.current;
      const newPct = dragStartPct.current + (delta / totalW) * 100;
      setLeftPct(Math.min(68, Math.max(24, newPct)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [leftPct]);

  if (loading) return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 rounded-full border-2 border-[#EFEFEF] border-t-[#111111] animate-spin"/>
          <span className="text-xs text-[#AAAAAA] font-medium">Loading problem…</span>
        </div>
      </div>
    </div>
  );
  if (!problem) return null;

  const ds  = DIFF_STYLE[problem.difficulty] || {};
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const shortcutLabel = isMac ? '⌘↵' : '⌃↵';

  const TABS = [
    { id: 'description', label: 'Description' },
    { id: 'testcases',   label: 'Test Cases' },
    { id: 'result',      label: 'Result' },
    { id: 'history',     label: 'History' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col">
      <Navbar />
      <div
        ref={containerRef}
        className="flex-1 flex flex-col lg:flex-row select-none"
        style={{ height: 'calc(100vh - 58px)' }}
      >
        {/* ── Left Panel ──────────────────────────────────────────────── */}
        <div
          className="bg-white flex flex-col border-r border-[#E8E8E8] overflow-hidden"
          style={{ width: `${leftPct}%`, minWidth: 280, maxWidth: '68%' }}
        >
          {/* Problem header */}
          <div className="px-5 py-4 border-b border-[#EFEFEF] bg-white shrink-0">
            <div className="flex items-start gap-3">
              <Link to="/problems" className="mt-0.5 text-[#CCCCCC] hover:text-[#555555] shrink-0 p-0.5 rounded hover:bg-[#F5F5F5]">
                <ChevronLeft className="w-4 h-4"/>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-[15px] font-bold text-[#111111] tracking-tight leading-snug">{problem.title}</h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {problem.difficulty && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ds.text} ${ds.bg} ${ds.border}`}>{problem.difficulty}</span>
                  )}
                  {(problem.tags||[]).map(t => (
                    <span key={t} className="text-[11px] text-[#888888] bg-[#F8F8F8] border border-[#E8E8E8] px-2 py-0.5 rounded-md font-mono">{t}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#EFEFEF] px-2 bg-white shrink-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 py-3 text-[13px] font-medium transition-colors ${
                  activeTab === tab.id ? 'text-[#111111]' : 'text-[#999999] hover:text-[#555555]'
                }`}
              >
                {tab.label}
                {tab.id === 'result' && result && (
                  <span className={`ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle mb-0.5 ${result.status==='passed'?'bg-[#16A34A]':'bg-[#DC2626]'}`}/>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#111111] rounded-t-full"/>
                )}
              </button>
            ))}
          </div>

          {/* Tab panels — all in DOM, CSS-toggled for instant switching */}
          <div className="flex-1 relative overflow-hidden">

            {/* Description */}
            <div className={`absolute inset-0 overflow-y-auto p-5 space-y-5 ${activeTab!=='description'?'hidden':''}`}>
              <div>
                <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-3">Description</p>
                <div className="text-[#333333] leading-relaxed text-sm whitespace-pre-wrap">{problem.description}</div>
              </div>
              {problem.constraints && (
                <div>
                  <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-2.5">Constraints</p>
                  <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3.5 font-mono text-xs text-[#444444] whitespace-pre-wrap leading-relaxed">{problem.constraints}</div>
                </div>
              )}
            </div>

            {/* Test Cases */}
            <div className={`absolute inset-0 overflow-y-auto p-5 space-y-3 ${activeTab!=='testcases'?'hidden':''}`}>
              <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-1">Visible Test Cases</p>
              {(problem.testcases||[]).filter(tc=>!tc.is_hidden).map((tc,i)=>(
                <div key={tc.testcase_id||i} className="border border-[#E8E8E8] rounded-xl overflow-hidden">
                  <div className="bg-[#FAFAFA] px-3.5 py-2 border-b border-[#E8E8E8]">
                    <span className="text-xs font-semibold text-[#888888]">Test case {i+1}</span>
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div>
                      <div className="text-[9px] font-bold text-[#BBBBBB] uppercase tracking-[0.12em] mb-1.5">Input</div>
                      <pre className="font-mono text-xs bg-[#FAFAFA] border border-[#E8E8E8] rounded-lg p-2.5 text-[#444444] overflow-x-auto">{tc.input_data}</pre>
                    </div>
                    <div>
                      <div className="text-[9px] font-bold text-[#BBBBBB] uppercase tracking-[0.12em] mb-1.5">Expected Output</div>
                      <pre className="font-mono text-xs bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-2.5 text-[#166534] overflow-x-auto">{tc.expected_output}</pre>
                    </div>
                  </div>
                </div>
              ))}
              {(problem.testcases||[]).filter(tc=>tc.is_hidden).length > 0 && (
                <div className="flex items-center gap-2 text-xs text-[#AAAAAA] mt-2">
                  <span className="w-5 h-5 rounded-md border border-[#E8E8E8] bg-[#F8F8F8] flex items-center justify-center text-[9px] font-bold text-[#CCCCCC]">?</span>
                  {(problem.testcases||[]).filter(tc=>tc.is_hidden).length} hidden test cases
                </div>
              )}
            </div>

            {/* Result */}
            <div className={`absolute inset-0 overflow-y-auto p-5 ${activeTab!=='result'?'hidden':''}`}>
              {submitting ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 py-16">
                  <div className="w-12 h-12 rounded-full border-2 border-[#E8E8E8] border-t-[#111111] animate-spin"/>
                  <div className="text-center">
                    <p className="text-[#333333] text-sm font-semibold">Running simulation…</p>
                    <p className="text-[#AAAAAA] text-xs mt-1">This usually takes a few seconds</p>
                  </div>
                </div>
              ) : result ? (
                <div className="space-y-4">
                  {/* Status banner */}
                  <div className={`flex items-center gap-3 p-4 rounded-2xl border ${
                    result.status==='passed' ? 'bg-[#F0FDF4] border-[#BBF7D0]' :
                    result.status==='failed' ? 'bg-[#FEF2F2] border-[#FECACA]' : 'bg-[#FFFBEB] border-[#FDE68A]'
                  }`}>
                    {result.status==='passed' ? <CheckCircle className="w-5 h-5 text-[#16A34A] shrink-0"/> :
                     result.status==='failed' ? <XCircle className="w-5 h-5 text-[#DC2626] shrink-0"/> :
                     <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0"/>}
                    <div>
                      <div className={`font-bold text-sm ${
                        result.status==='passed'?'text-[#166534]':result.status==='failed'?'text-[#991B1B]':'text-[#92400E]'
                      }`}>
                        {result.status==='passed'?'All test cases passed!':result.status==='failed'?'Wrong answer':'Compilation / runtime error'}
                      </div>
                      {result.passed_count!=null && (
                        <div className={`text-xs mt-0.5 font-medium ${
                          result.status==='passed'?'text-[#16A34A]':result.status==='failed'?'text-[#DC2626]':'text-[#D97706]'
                        }`}>{result.passed_count} / {result.total_count} test cases</div>
                      )}
                    </div>
                  </div>

                  {result.compilation_error && (
                    <div className="rounded-xl overflow-hidden border border-[#FECACA]">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-[#FEF2F2] border-b border-[#FECACA]">
                        <div className="flex items-center gap-2 text-[#DC2626] text-xs font-bold uppercase tracking-wide">
                          <AlertCircle className="w-3.5 h-3.5"/>
                          {result.status==='error'?'Compilation Error':'Simulation Error'}
                        </div>
                        <button onClick={()=>navigator.clipboard?.writeText(result.compilation_error)} className="text-xs text-[#888888] hover:text-[#111111] px-2 py-0.5 rounded">Copy</button>
                      </div>
                      <pre className="font-mono text-xs bg-white p-4 text-[#DC2626] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                        {result.compilation_error.replace(/\/tmp\/[^\s/:]*/g,'<tmp>')}
                      </pre>
                    </div>
                  )}

                  {result.testcase_results?.length > 0 && !result.compilation_error && (
                    <div className="space-y-2">
                      <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">Test Results</p>
                      {result.testcase_results.map((tc,i)=>(
                        <div key={i} className={`flex flex-col gap-1 p-3 rounded-xl border text-sm ${tc.passed?'bg-[#F0FDF4] border-[#BBF7D0]':'bg-[#FEF2F2] border-[#FECACA]'}`}>
                          <div className="flex items-center gap-2">
                            {tc.passed ? <CheckCircle className="w-3.5 h-3.5 text-[#16A34A] shrink-0"/> : <XCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0"/>}
                            <span className={`text-xs font-bold ${tc.passed?'text-[#166534]':'text-[#991B1B]'}`}>Test {i+1}</span>
                            {tc.output && <span className="text-[#888888] font-mono text-xs ml-auto"><span className="text-[#AAAAAA]">got:</span> {tc.output.trim()}</span>}
                          </div>
                          {tc.error && <pre className="ml-5 text-xs font-mono text-[#DC2626] whitespace-pre-wrap">{tc.error}</pre>}
                        </div>
                      ))}
                    </div>
                  )}

                  {result.lint_warnings?.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-[#FDE68A]">
                      <div className="px-4 py-2 bg-[#FFFBEB] border-b border-[#FDE68A] text-xs font-bold text-[#D97706] uppercase tracking-wide">
                        Lint Warnings ({result.lint_warnings.length})
                      </div>
                      <div className="p-3 space-y-1 max-h-32 overflow-y-auto bg-white">
                        {result.lint_warnings.map((w,i)=><div key={i} className="font-mono text-xs text-[#D97706]">{w}</div>)}
                      </div>
                    </div>
                  )}

                  {result.waveform_json && <WaveformViewer data={result.waveform_json}/>}

                  {result.submission_id && result.has_waveform && (
                    <a href={`${API}/api/submissions/${result.submission_id}/vcd`} className="inline-flex items-center gap-1.5 text-xs text-[#555555] hover:text-[#111111] hover:underline" target="_blank" rel="noreferrer">
                      <Download className="w-3.5 h-3.5"/> Download VCD
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] flex items-center justify-center mb-4">
                    <Play className="w-6 h-6 text-[#CCCCCC]"/>
                  </div>
                  <p className="text-[#555555] text-sm font-semibold">Run your code to see results</p>
                  <p className="text-[#AAAAAA] text-xs mt-1">Press {shortcutLabel} or click Submit</p>
                </div>
              )}
            </div>

            {/* History */}
            <div className={`absolute inset-0 overflow-y-auto p-5 ${activeTab!=='history'?'hidden':''}`}>
              <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-3">Submission History</p>
              {history === null ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_,i)=><div key={i} className="h-12 rounded-xl shimmer"/>)}
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Circle className="w-8 h-8 text-[#EEEEEE] mb-3"/>
                  <p className="text-[#888888] text-sm font-semibold">No submissions yet</p>
                  <p className="text-[#CCCCCC] text-xs mt-1">Submit your code to see history here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((s,i) => {
                    const cfg = STATUS[s.status] || STATUS.error;
                    return (
                      <Link
                        key={s.submission_id}
                        to={`/submissions/${s.submission_id}`}
                        className="flex items-center gap-3 p-3 rounded-xl border border-[#F0F0F0] hover:border-[#E0E0E0] hover:bg-[#FAFAFA] transition-all group"
                      >
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg border shrink-0 ${cfg.text} ${cfg.bg} ${cfg.border}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[#888888]">
                              {s.passed_count != null ? `${s.passed_count}/${s.total_count} tests` : ''}
                            </span>
                            <span className="text-[10px] text-[#CCCCCC] font-mono capitalize">{s.language}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#CCCCCC] shrink-0">
                          <Clock className="w-3 h-3"/>
                          {new Date(s.submitted_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-[#DDDDDD] group-hover:text-[#888888] -rotate-90"/>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Drag handle ─────────────────────────────────────────────── */}
        <div
          onMouseDown={onDragStart}
          className="hidden lg:flex items-center justify-center w-[5px] shrink-0 bg-[#E8E8E8] hover:bg-[#111111] cursor-col-resize group transition-colors z-10"
          title="Drag to resize"
          style={{ userSelect: 'none' }}
        >
          <div className="w-[3px] h-8 rounded-full bg-[#CCCCCC] group-hover:bg-white transition-colors"/>
        </div>

        {/* ── Right Panel — editor ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col editor-pane" style={{ background: '#1e1e1e', minWidth: 320 }}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ background: '#252526', borderBottom: '1px solid #333333' }}>
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ color:'#CCCCCC', background:'#2D2D2D', border:'1px solid #3E3E3E' }}
                onMouseEnter={e=>e.currentTarget.style.background='#3A3A3A'}
                onMouseLeave={e=>e.currentTarget.style.background='#2D2D2D'}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background:'#4FC1FF' }}/>
                {LANGUAGES.find(l=>l.value===language)?.label||'Verilog'}
                <ChevronDown className="w-3 h-3" style={{ color:'#888888' }}/>
              </button>
              {langMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 rounded-xl z-50 overflow-hidden" style={{ background:'#2D2D2D', border:'1px solid #3E3E3E', boxShadow:'0 8px 32px rgba(0,0,0,0.4)' }}>
                  {LANGUAGES.map(lang => (
                    <button key={lang.value} onClick={()=>!lang.disabled&&handleLanguageChange(lang.value)} disabled={lang.disabled}
                      className="w-full text-left px-3 py-2.5 text-sm transition-colors"
                      style={{ color:lang.disabled?'#555555':language===lang.value?'#4FC1FF':'#CCCCCC', background:language===lang.value?'rgba(79,193,255,0.1)':'transparent', cursor:lang.disabled?'not-allowed':'pointer' }}
                      onMouseEnter={e=>{if(!lang.disabled&&language!==lang.value)e.currentTarget.style.background='#3A3A3A';}}
                      onMouseLeave={e=>{e.currentTarget.style.background=language===lang.value?'rgba(79,193,255,0.1)':'transparent';}}
                    >{lang.label}</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {saveStatus==='saving' && <span className="flex items-center gap-1.5 text-xs" style={{color:'#888888'}}><Loader2 className="w-3 h-3 animate-spin"/>Saving…</span>}
              {saveStatus==='saved'  && <span className="flex items-center gap-1.5 text-xs" style={{color:'#4ADE80'}}><CheckCircle className="w-3 h-3"/>Saved</span>}
              <span className="hidden sm:flex items-center gap-1 text-xs" style={{color:'#555555'}}>
                <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono" style={{ background:'#333333', border:'1px solid #444444', color:'#888888' }}>{shortcutLabel}</kbd>
              </span>
              <button
                onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg transition-all disabled:opacity-50"
                style={{ background: submitting?'#2D2D2D':'#FFFFFF', color: submitting?'#888888':'#111111' }}
                onMouseEnter={e=>{if(!submitting)e.currentTarget.style.background='#F0F0F0';}}
                onMouseLeave={e=>{if(!submitting)e.currentTarget.style.background='#FFFFFF';}}
              >
                {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin"/>Running…</> : <><Play className="w-3.5 h-3.5"/>Submit</>}
              </button>
            </div>
          </div>

          {/* Monaco */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={LANGUAGES.find(l=>l.value===language)?.monacoLang||'verilog'}
              value={code}
              onChange={handleCodeChange}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                automaticLayout: true,
                wordWrap: 'on',
                lineHeight: 22,
                letterSpacing: 0.3,
                smoothScrolling: true,
                cursorSmoothCaretAnimation: 'on',
                cursorBlinking: 'phase',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
