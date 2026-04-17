import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import Editor from '@monaco-editor/react';
import { Play, ChevronLeft, CheckCircle, XCircle, AlertCircle, Loader2, Download, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';

const DIFF_STYLE = {
  Easy:      { text: 'text-[#16A34A]', bg: 'bg-[#F0FDF4]', border: 'border-[#BBF7D0]' },
  Medium:    { text: 'text-[#D97706]', bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]' },
  Hard:      { text: 'text-[#DC2626]', bg: 'bg-[#FEF2F2]', border: 'border-[#FECACA]' },
};

const LANGUAGES = [
  { value: 'verilog',       label: 'Verilog',       monacoLang: 'verilog', disabled: false },
  { value: 'systemverilog', label: 'SystemVerilog',  monacoLang: 'verilog', disabled: false },
  { value: 'vhdl',          label: 'VHDL',           monacoLang: 'vhdl',    disabled: false },
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

// ─── Waveform Viewer ─────────────────────────────────────────────────────────
const WAVEFORM_COLORS = ['#2563EB', '#16A34A', '#D97706', '#9333EA', '#DB2777', '#0891B2', '#EA580C', '#64748B'];

function WaveformViewer({ data }) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  if (!data || !data.signals || Object.keys(data.signals).length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[#AAAAAA] text-xs">
        No waveform data available
      </div>
    );
  }

  const signals = Object.entries(data.signals);
  const maxTime = data.max_time || 1;
  const timescale = data.timescale || '1ns';

  const LABEL_W = 80;
  const ROW_H = 28;
  const SIG_H = 18;
  const Y_PAD = (ROW_H - SIG_H) / 2;
  const TICK_COUNT = 8;

  const totalW = Math.max(400, (containerRef.current?.clientWidth || 600) - LABEL_W - 24);
  const scaledW = totalW * zoom;
  const totalH = signals.length * ROW_H + 24;

  const tx = (t) => (t / maxTime) * scaledW;

  function buildPath(points) {
    if (!points || points.length === 0) return '';
    const segments = [];
    for (let i = 0; i < points.length; i++) {
      const [t, v] = points[i];
      const nextT = i + 1 < points.length ? points[i + 1][0] : maxTime;
      const x0 = tx(t);
      const x1 = tx(nextT);
      const isHigh = v === '1' || v === 1 || v === 'H' || v === 'h';
      const y = isHigh ? Y_PAD : Y_PAD + SIG_H;
      if (i === 0) segments.push(`M ${x0} ${y}`);
      else segments.push(`V ${y}`);
      segments.push(`H ${x1}`);
    }
    return segments.join(' ');
  }

  const tickInterval = maxTime / TICK_COUNT;

  return (
    <div className="rounded-xl overflow-hidden border border-[#E8E8E8] bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E8E8E8] bg-[#FAFAFA]">
        <span className="text-xs font-semibold text-[#111111]">Waveform</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#888888] mr-2">Timescale: {timescale}</span>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-1 rounded text-[#888888] hover:text-[#111111] hover:bg-[#F0F0F0] transition-colors" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.min(8, z + 0.5))} className="p-1 rounded text-[#888888] hover:text-[#111111] hover:bg-[#F0F0F0] transition-colors" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-[#555555] ml-1 w-8 text-right font-mono">{zoom}×</span>
        </div>
      </div>
      <div className="overflow-x-auto" ref={containerRef}>
        <div style={{ display: 'flex', minWidth: '100%' }}>
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            <div style={{ height: 20 }} />
            {signals.map(([name], idx) => (
              <div key={name} style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 8, paddingRight: 4 }}>
                <span className="text-xs font-mono truncate" style={{ color: WAVEFORM_COLORS[idx % WAVEFORM_COLORS.length] }} title={name}>{name}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, overflowX: zoom > 1 ? 'auto' : 'visible' }}>
            <svg width={scaledW} height={totalH} style={{ display: 'block' }}>
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
                const x = tx(i * tickInterval);
                return <line key={i} x1={x} y1={20} x2={x} y2={totalH} stroke="#F0F0F0" strokeWidth="1" />;
              })}
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
                const t = i * tickInterval;
                const x = tx(t);
                return (
                  <g key={i}>
                    <line x1={x} y1={14} x2={x} y2={20} stroke="#CCCCCC" strokeWidth="1" />
                    <text x={x} y={10} textAnchor="middle" fontSize="8" fill="#CCCCCC">{t}</text>
                  </g>
                );
              })}
              {signals.map(([name, points], idx) => {
                const color = WAVEFORM_COLORS[idx % WAVEFORM_COLORS.length];
                const yOffset = 20 + idx * ROW_H;
                const path = buildPath(points);
                return (
                  <g key={name} transform={`translate(0, ${yOffset})`}>
                    <rect x={0} y={0} width={scaledW} height={ROW_H} fill="transparent" />
                    {path && <path d={path} stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round" />}
                    {points && points.map(([t, v], pi) => {
                      const nextT = pi + 1 < points.length ? points[pi + 1][0] : maxTime;
                      const segW = tx(nextT) - tx(t);
                      if (segW < 16) return null;
                      const isHigh = v === '1' || v === 1 || v === 'H' || v === 'h';
                      return (
                        <text key={pi} x={tx(t) + segW / 2} y={isHigh ? Y_PAD - 1 : Y_PAD + SIG_H + 8}
                          textAnchor="middle" fontSize="7" fill={color} opacity="0.6">{String(v)}</text>
                      );
                    })}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProblemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('verilog');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('description');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved'

  const saveTimerRef = useRef(null);
  const savedIndicatorTimerRef = useRef(null);
  const langRef = useRef(language);
  useEffect(() => { langRef.current = language; }, [language]);

  const saveCode = useCallback(async (codeToSave, langToSave) => {
    if (!id) return;
    setSaveStatus('saving');
    try {
      await axios.put(`${API}/api/user-code/${id}`, { code: codeToSave, language: langToSave }, { withCredentials: true });
      setSaveStatus('saved');
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
      savedIndicatorTimerRef.current = setTimeout(() => setSaveStatus(null), 3000);
    } catch {
      setSaveStatus(null);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedIndicatorTimerRef.current) clearTimeout(savedIndicatorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      axios.get(`${API}/api/problems/${id}`, { withCredentials: true }),
      axios.get(`${API}/api/user-code/${id}`, { withCredentials: true }),
    ]).then(([problemRes, savedCodeRes]) => {
      if (problemRes.status === 'rejected') { navigate('/problems'); return; }
      const prob = problemRes.value.data;
      setProblem(prob);
      if (savedCodeRes.status === 'fulfilled' && savedCodeRes.value.data?.code) {
        setCode(savedCodeRes.value.data.code);
        if (savedCodeRes.value.data.language) {
          setLanguage(savedCodeRes.value.data.language);
          langRef.current = savedCodeRes.value.data.language;
        }
      } else {
        setCode(prob.starter_code || DEFAULT_CODE.verilog);
      }
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  const handleCodeChange = useCallback((val) => {
    const newCode = val || '';
    setCode(newCode);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveCode(newCode, langRef.current); }, 2500);
  }, [saveCode]);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    langRef.current = lang;
    setLangMenuOpen(false);
    const isDefault = Object.values(DEFAULT_CODE).some(d => code.trim() === d.trim());
    if (isDefault) setCode(problem?.starter_code || DEFAULT_CODE[lang]);
  };

  const handleSubmit = async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    saveCode(code, language);
    setSubmitting(true);
    setResult(null);
    setActiveTab('result');
    try {
      const res = await axios.post(`${API}/api/submissions`, { problem_id: id, code, language }, { withCredentials: true });
      setResult(res.data);
    } catch (err) {
      setResult({ status: 'error', compilation_error: err.response?.data?.detail || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-[#888888] animate-spin" />
      </div>
    </div>
  );

  if (!problem) return null;

  const ds = DIFF_STYLE[problem.difficulty] || {};

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row max-w-full">

        {/* ── Left Panel — white, problem description ────────────── */}
        <div className="lg:w-[42%] xl:w-[38%] flex flex-col border-r border-[#E8E8E8] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>

          {/* Problem header */}
          <div className="px-5 py-4 border-b border-[#E8E8E8] flex items-center gap-3">
            <Link to="/problems" className="text-[#AAAAAA] hover:text-[#111111] transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-bold text-[#111111] tracking-tight truncate">{problem.title}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {problem.difficulty && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ds.text} ${ds.bg} ${ds.border}`}>
                    {problem.difficulty}
                  </span>
                )}
                {(problem.tags || []).map(t => (
                  <span key={t} className="text-xs text-[#888888] bg-[#F5F5F5] border border-[#E8E8E8] px-2 py-0.5 rounded font-mono">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#E8E8E8]">
            {['description', 'testcases', 'result'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors relative ${
                  activeTab === tab ? 'text-[#111111]' : 'text-[#888888] hover:text-[#555555]'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#111111] rounded-t" />
                )}
                {tab === 'result' && result && (
                  <span className={`ml-1.5 text-xs ${result.status === 'passed' ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>●</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'description' && (
              <div className="p-5 space-y-5">
                <div>
                  <p className="text-[9px] font-semibold tracking-widest text-[#AAAAAA] uppercase mb-2.5">Description</p>
                  <div className="text-[#333333] leading-relaxed text-sm whitespace-pre-wrap">{problem.description}</div>
                </div>
                {problem.constraints && (
                  <div>
                    <p className="text-[9px] font-semibold tracking-widest text-[#AAAAAA] uppercase mb-2.5">Constraints</p>
                    <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-lg p-3 font-mono text-xs text-[#444444] whitespace-pre-wrap leading-relaxed">
                      {problem.constraints}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'testcases' && (
              <div className="p-5 space-y-3">
                <p className="text-[9px] font-semibold tracking-widest text-[#AAAAAA] uppercase mb-3">Visible Test Cases</p>
                {(problem.testcases || []).filter(tc => !tc.is_hidden).map((tc, i) => (
                  <div key={tc.testcase_id || i} className="border border-[#E8E8E8] rounded-xl overflow-hidden">
                    <div className="bg-[#FAFAFA] px-3 py-2 border-b border-[#E8E8E8]">
                      <span className="text-xs font-semibold text-[#888888]">Test case {i + 1}</span>
                    </div>
                    <div className="p-3 space-y-2.5">
                      <div>
                        <div className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wider mb-1">Input</div>
                        <pre className="font-mono text-xs bg-[#FAFAFA] border border-[#E8E8E8] rounded-lg p-2.5 text-[#444444] overflow-x-auto">{tc.input_data}</pre>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-[#AAAAAA] uppercase tracking-wider mb-1">Expected Output</div>
                        <pre className="font-mono text-xs bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-2.5 text-[#166534] overflow-x-auto">{tc.expected_output}</pre>
                      </div>
                    </div>
                  </div>
                ))}
                {(problem.testcases || []).filter(tc => tc.is_hidden).length > 0 && (
                  <p className="text-xs text-[#AAAAAA] mt-1 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded border border-[#E8E8E8] bg-[#F5F5F5] flex items-center justify-center text-[8px] text-[#CCCCCC]">?</span>
                    {(problem.testcases || []).filter(tc => tc.is_hidden).length} hidden test cases
                  </p>
                )}
              </div>
            )}

            {activeTab === 'result' && (
              <div className="p-5">
                {submitting ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 className="w-6 h-6 text-[#888888] animate-spin" />
                    <p className="text-[#888888] text-sm">Running simulation…</p>
                  </div>
                ) : result ? (
                  <div className="space-y-4">
                    {/* Status banner */}
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                      result.status === 'passed'
                        ? 'bg-[#F0FDF4] border-[#BBF7D0]'
                        : result.status === 'failed'
                          ? 'bg-[#FEF2F2] border-[#FECACA]'
                          : 'bg-[#FFFBEB] border-[#FDE68A]'
                    }`}>
                      {result.status === 'passed'
                        ? <CheckCircle className="w-5 h-5 text-[#16A34A] shrink-0" />
                        : result.status === 'failed'
                          ? <XCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
                          : <AlertCircle className="w-5 h-5 text-[#D97706] shrink-0" />}
                      <div>
                        <div className={`font-semibold text-sm ${
                          result.status === 'passed' ? 'text-[#166534]' :
                          result.status === 'failed' ? 'text-[#991B1B]' : 'text-[#92400E]'
                        }`}>
                          {result.status === 'passed' ? 'All test cases passed!' :
                           result.status === 'failed' ? 'Wrong answer' : 'Compilation / runtime error'}
                        </div>
                        {result.passed_count != null && (
                          <div className={`text-xs mt-0.5 ${
                            result.status === 'passed' ? 'text-[#16A34A]' :
                            result.status === 'failed' ? 'text-[#DC2626]' : 'text-[#D97706]'
                          }`}>
                            {result.passed_count} / {result.total_count} test cases
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Compilation error */}
                    {result.compilation_error && (
                      <div className="rounded-xl overflow-hidden border border-[#FECACA]">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#FEF2F2] border-b border-[#FECACA]">
                          <div className="flex items-center gap-2 text-[#DC2626] text-xs font-semibold uppercase tracking-wide">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {result.status === 'error' ? 'Compilation Error' : 'Simulation Error'}
                          </div>
                          <button
                            onClick={() => navigator.clipboard?.writeText(result.compilation_error)}
                            className="text-xs text-[#888888] hover:text-[#111111] px-2 py-0.5 rounded transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="font-mono text-xs bg-white p-4 text-[#DC2626] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                          {result.compilation_error.replace(/\/tmp\/[^\s/:]*/g, '<tmp>')}
                        </pre>
                      </div>
                    )}

                    {/* Test results */}
                    {result.testcase_results && result.testcase_results.length > 0 && !result.compilation_error && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-semibold tracking-widest text-[#AAAAAA] uppercase">Results</p>
                        {result.testcase_results.map((tc, i) => (
                          <div key={i} className={`flex flex-col gap-1 p-2.5 rounded-lg border text-sm ${
                            tc.passed ? 'bg-[#F0FDF4] border-[#BBF7D0]' : 'bg-[#FEF2F2] border-[#FECACA]'
                          }`}>
                            <div className="flex items-center gap-2">
                              {tc.passed
                                ? <CheckCircle className="w-3.5 h-3.5 text-[#16A34A] shrink-0" />
                                : <XCircle className="w-3.5 h-3.5 text-[#DC2626] shrink-0" />}
                              <span className={`text-xs font-semibold ${tc.passed ? 'text-[#166534]' : 'text-[#991B1B]'}`}>
                                Test {i + 1}
                              </span>
                              {tc.output && (
                                <span className="text-[#888888] font-mono text-xs ml-auto">
                                  <span className="text-[#AAAAAA]">got:</span> {tc.output.trim()}
                                </span>
                              )}
                            </div>
                            {tc.error && (
                              <pre className="ml-5 text-xs font-mono text-[#DC2626] whitespace-pre-wrap">{tc.error}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lint warnings */}
                    {result.lint_warnings && result.lint_warnings.length > 0 && (
                      <div className="rounded-xl overflow-hidden border border-[#FDE68A]">
                        <div className="px-4 py-2 bg-[#FFFBEB] border-b border-[#FDE68A] text-xs font-semibold text-[#D97706] uppercase tracking-wide">
                          Lint Warnings ({result.lint_warnings.length})
                        </div>
                        <div className="p-3 space-y-1 max-h-32 overflow-y-auto bg-white">
                          {result.lint_warnings.map((w, i) => (
                            <div key={i} className="font-mono text-xs text-[#D97706]">{w}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Waveform */}
                    {result.waveform_json && <WaveformViewer data={result.waveform_json} />}

                    {/* VCD download */}
                    {result.submission_id && result.has_waveform && (
                      <a
                        href={`${API}/api/submissions/${result.submission_id}/vcd`}
                        className="inline-flex items-center gap-1.5 text-xs text-[#555555] hover:text-[#111111] hover:underline transition-colors"
                        target="_blank" rel="noreferrer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download VCD
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-3">
                      <Play className="w-5 h-5 text-[#CCCCCC]" />
                    </div>
                    <p className="text-[#AAAAAA] text-sm">Submit your code to see results</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel — dark editor ──────────────────────────── */}
        <div className="flex-1 flex flex-col editor-pane" style={{ minHeight: '500px', background: '#1e1e1e' }}>
          {/* Editor toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ background: '#252526', borderColor: '#333333' }}>
            {/* Language selector */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                style={{ color: '#CCCCCC', background: '#2D2D2D', border: '1px solid #3E3E3E' }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#4FC1FF' }} />
                {LANGUAGES.find(l => l.value === language)?.label || 'Verilog'}
                <ChevronDown className="w-3 h-3" style={{ color: '#888888' }} />
              </button>
              {langMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 rounded-lg shadow-xl z-50 overflow-hidden" style={{ background: '#2D2D2D', border: '1px solid #3E3E3E' }}>
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => !lang.disabled && handleLanguageChange(lang.value)}
                      disabled={lang.disabled}
                      className="w-full text-left px-3 py-2 text-sm transition-colors"
                      style={{
                        color: lang.disabled ? '#555555' : language === lang.value ? '#4FC1FF' : '#CCCCCC',
                        background: language === lang.value ? 'rgba(79,193,255,0.1)' : 'transparent',
                        cursor: lang.disabled ? 'not-allowed' : 'pointer',
                      }}
                      onMouseEnter={e => { if (!lang.disabled && language !== lang.value) e.currentTarget.style.background = '#3A3A3A'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = language === lang.value ? 'rgba(79,193,255,0.1)' : 'transparent'; }}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right side: save status + submit */}
            <div className="flex items-center gap-3">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#888888' }}>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving…
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1.5 text-xs" style={{ color: '#16A34A' }}>
                  <CheckCircle className="w-3 h-3" />
                  Saved
                </span>
              )}
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-md transition-all disabled:opacity-50"
                style={{ background: '#FFFFFF', color: '#111111' }}
                onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = '#F0F0F0'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; }}
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {submitting ? 'Running…' : 'Submit'}
              </button>
            </div>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={LANGUAGES.find(l => l.value === language)?.monacoLang || 'verilog'}
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
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
