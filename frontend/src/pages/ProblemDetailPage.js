import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import Editor from '@monaco-editor/react';
import { Play, ChevronLeft, CheckCircle, XCircle, AlertCircle, Loader2, Download, ChevronDown, ZoomIn, ZoomOut } from 'lucide-react';

const DIFF_COLORS = { Easy: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/25', Medium: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/25', Hard: 'text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/25' };

const LANGUAGES = [
  { value: 'verilog', label: 'Verilog', monacoLang: 'verilog', disabled: false },
  { value: 'systemverilog', label: 'SystemVerilog', monacoLang: 'verilog', disabled: false },
  { value: 'vhdl', label: 'VHDL', monacoLang: 'vhdl', disabled: false },
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
// Renders a digital (2-state) waveform as an inline SVG.
// data: { signals: { name: [[time, value], ...] }, max_time, timescale }

const WAVEFORM_COLORS = [
  '#4A8FE8', '#22C55E', '#F59E0B', '#A855F7',
  '#EC4899', '#14B8A6', '#F97316', '#64748B',
];

function WaveformViewer({ data }) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  if (!data || !data.signals || Object.keys(data.signals).length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-[#7A8FA8] text-xs">
        No waveform data available
      </div>
    );
  }

  const signals = Object.entries(data.signals);
  const maxTime = data.max_time || 1;
  const timescale = data.timescale || '1ns';

  // Layout constants
  const LABEL_W = 80;
  const ROW_H = 28;
  const SIG_H = 18;
  const Y_PAD = (ROW_H - SIG_H) / 2;
  const TICK_COUNT = 8;

  const totalW = Math.max(400, (containerRef.current?.clientWidth || 600) - LABEL_W - 24);
  const scaledW = totalW * zoom;
  const totalH = signals.length * ROW_H + 24; // +24 for time axis

  // Convert time → x pixel
  const tx = (t) => (t / maxTime) * scaledW;

  // Build SVG path for one signal
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
      else {
        // Vertical transition
        segments.push(`V ${y}`);
      }
      // Horizontal run
      segments.push(`H ${x1}`);
    }
    return segments.join(' ');
  }

  const tickInterval = maxTime / TICK_COUNT;

  return (
    <div className="rounded-xl overflow-hidden border border-[#1E2530] bg-[#0D1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1E2530] bg-[#13171E]">
        <span className="text-xs font-semibold text-[#E8EDF4]">Waveform Viewer</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#7A8FA8] mr-2">Timescale: {timescale}</span>
          <button
            onClick={() => setZoom(z => Math.max(0.5, z - 0.5))}
            className="p-1 rounded text-[#7A8FA8] hover:text-[#E8EDF4] hover:bg-[#1A1F28] transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(z => Math.min(8, z + 0.5))}
            className="p-1 rounded text-[#7A8FA8] hover:text-[#E8EDF4] hover:bg-[#1A1F28] transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-[#4A8FA8] ml-1 w-8 text-right">{zoom}×</span>
        </div>
      </div>

      {/* Waveform body */}
      <div className="overflow-x-auto" ref={containerRef}>
        <div style={{ display: 'flex', minWidth: '100%' }}>
          {/* Signal labels */}
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            <div style={{ height: 20 }} /> {/* spacer for time axis */}
            {signals.map(([name], idx) => (
              <div
                key={name}
                style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 8, paddingRight: 4 }}
              >
                <span
                  className="text-xs font-mono truncate"
                  style={{ color: WAVEFORM_COLORS[idx % WAVEFORM_COLORS.length] }}
                  title={name}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>

          {/* SVG waveform area */}
          <div style={{ flex: 1, overflowX: zoom > 1 ? 'auto' : 'visible' }}>
            <svg
              width={scaledW}
              height={totalH}
              style={{ display: 'block' }}
            >
              {/* Grid lines */}
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
                const x = tx(i * tickInterval);
                return (
                  <line
                    key={i}
                    x1={x} y1={20} x2={x} y2={totalH}
                    stroke="#1E2530" strokeWidth="1"
                  />
                );
              })}

              {/* Time axis labels */}
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
                const t = i * tickInterval;
                const x = tx(t);
                return (
                  <g key={i}>
                    <line x1={x} y1={14} x2={x} y2={20} stroke="#4A5568" strokeWidth="1" />
                    <text
                      x={x} y={10}
                      textAnchor="middle"
                      fontSize="8"
                      fill="#4A5568"
                    >
                      {t}
                    </text>
                  </g>
                );
              })}

              {/* Signal waveforms */}
              {signals.map(([name, points], idx) => {
                const color = WAVEFORM_COLORS[idx % WAVEFORM_COLORS.length];
                const yOffset = 20 + idx * ROW_H;
                const path = buildPath(points);

                return (
                  <g key={name} transform={`translate(0, ${yOffset})`}>
                    {/* Row background on hover — achieved via rect */}
                    <rect x={0} y={0} width={scaledW} height={ROW_H} fill="transparent" />
                    {/* Waveform path */}
                    {path && (
                      <path
                        d={path}
                        stroke={color}
                        strokeWidth="1.5"
                        fill="none"
                        strokeLinejoin="round"
                      />
                    )}
                    {/* Value labels on each segment */}
                    {points && points.map(([t, v], pi) => {
                      const nextT = pi + 1 < points.length ? points[pi + 1][0] : maxTime;
                      const segW = tx(nextT) - tx(t);
                      if (segW < 16) return null;
                      const isHigh = v === '1' || v === 1 || v === 'H' || v === 'h';
                      return (
                        <text
                          key={pi}
                          x={tx(t) + segW / 2}
                          y={isHigh ? Y_PAD - 1 : Y_PAD + SIG_H + 8}
                          textAnchor="middle"
                          fontSize="7"
                          fill={color}
                          opacity="0.6"
                        >
                          {String(v)}
                        </text>
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

  useEffect(() => {
    axios.get(`${API}/api/problems/${id}`, { withCredentials: true })
      .then(res => {
        setProblem(res.data);
        setCode(res.data.starter_code || DEFAULT_CODE.verilog);
      })
      .catch(() => navigate('/problems'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    setLangMenuOpen(false);
    const isDefault = Object.values(DEFAULT_CODE).some(d => code.trim() === d.trim());
    if (isDefault) {
      setCode(problem?.starter_code || DEFAULT_CODE[lang]);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setResult(null);
    setActiveTab('result');
    try {
      const res = await axios.post(`${API}/api/submissions`, {
        problem_id: id,
        code,
        language,
      }, { withCredentials: true });
      setResult(res.data);
    } catch (err) {
      setResult({ status: 'error', compilation_error: err.response?.data?.detail || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4A8FE8] animate-spin" />
      </div>
    </div>
  );

  if (!problem) return null;

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col lg:flex-row max-w-full">
        {/* Left Panel - Problem */}
        <div className="lg:w-[42%] xl:w-[38%] flex flex-col border-r border-[#1E2530] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 56px)' }}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-[#1E2530] flex items-center gap-3 bg-[#13171E]">
            <Link to="/problems" className="text-[#7A8FA8] hover:text-[#E8EDF4] transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-[#E8EDF4] truncate">{problem.title}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${DIFF_COLORS[problem.difficulty] || ''}`}>
                  {problem.difficulty}
                </span>
                {(problem.tags || []).map(t => (
                  <span key={t} className="text-xs text-[#7A8FA8] bg-[#1A1F28] border border-[#1E2530] px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#1E2530] bg-[#13171E]">
            {['description', 'testcases', 'result'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-[#4A8FE8] border-b-2 border-[#4A8FE8]'
                    : 'text-[#7A8FA8] hover:text-[#E8EDF4]'
                }`}
              >
                {tab}
                {tab === 'result' && result && (
                  <span className={`ml-1.5 text-xs ${result.status === 'passed' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>●</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 p-5 overflow-y-auto text-sm text-[#E8EDF4]">
            {activeTab === 'description' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide mb-2">Description</h3>
                  <div className="text-[#C8D4E0] leading-relaxed whitespace-pre-wrap">{problem.description}</div>
                </div>
                {problem.constraints && (
                  <div>
                    <h3 className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide mb-2">Constraints</h3>
                    <div className="bg-[#1A1F28] border border-[#1E2530] rounded-lg p-3 font-mono text-xs text-[#C8D4E0] whitespace-pre-wrap">{problem.constraints}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'testcases' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide mb-3">Test Cases</h3>
                {(problem.testcases || []).filter(tc => !tc.is_hidden).map((tc, i) => (
                  <div key={tc.testcase_id || i} className="bg-[#1A1F28] border border-[#1E2530] rounded-lg p-3 space-y-2">
                    <div className="text-xs font-semibold text-[#7A8FA8]">Test {i + 1}</div>
                    <div>
                      <div className="text-xs text-[#7A8FA8] mb-1">Input</div>
                      <pre className="font-mono text-xs bg-[#13171E] border border-[#1E2530] rounded p-2 text-[#C8D4E0] overflow-x-auto">{tc.input_data}</pre>
                    </div>
                    <div>
                      <div className="text-xs text-[#7A8FA8] mb-1">Expected Output</div>
                      <pre className="font-mono text-xs bg-[#13171E] border border-[#1E2530] rounded p-2 text-[#22C55E] overflow-x-auto">{tc.expected_output}</pre>
                    </div>
                  </div>
                ))}
                {(problem.testcases || []).filter(tc => tc.is_hidden).length > 0 && (
                  <p className="text-xs text-[#7A8FA8] mt-2">+ {(problem.testcases || []).filter(tc => tc.is_hidden).length} hidden test cases</p>
                )}
              </div>
            )}

            {activeTab === 'result' && (
              <div>
                {submitting ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <Loader2 className="w-8 h-8 text-[#4A8FE8] animate-spin" />
                    <p className="text-[#7A8FA8] text-sm">Running simulation...</p>
                  </div>
                ) : result ? (
                  <div className="space-y-4">
                    {/* Status banner */}
                    <div className={`flex items-center gap-3 p-4 rounded-xl border ${
                      result.status === 'passed' ? 'bg-[#22C55E]/10 border-[#22C55E]/25' :
                      result.status === 'failed' ? 'bg-[#EF4444]/10 border-[#EF4444]/25' :
                      'bg-[#F59E0B]/10 border-[#F59E0B]/25'
                    }`}>
                      {result.status === 'passed' ? <CheckCircle className="w-6 h-6 text-[#22C55E]" /> :
                       result.status === 'failed' ? <XCircle className="w-6 h-6 text-[#EF4444]" /> :
                       <AlertCircle className="w-6 h-6 text-[#F59E0B]" />}
                      <div>
                        <div className={`font-semibold capitalize ${
                          result.status === 'passed' ? 'text-[#22C55E]' :
                          result.status === 'failed' ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                        }`}>
                          {result.status === 'passed' ? 'All tests passed!' :
                           result.status === 'failed' ? 'Wrong Answer' : 'Compilation / Runtime Error'}
                        </div>
                        {result.passed_count != null && (
                          <div className="text-sm text-[#7A8FA8]">{result.passed_count}/{result.total_count} test cases passed</div>
                        )}
                      </div>
                    </div>

                    {/* Compilation / simulation error — prominently shown */}
                    {result.compilation_error && (
                      <div className="rounded-xl overflow-hidden border border-[#EF4444]/40">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-[#EF4444]/15 border-b border-[#EF4444]/30">
                          <div className="flex items-center gap-2 text-[#EF4444] text-xs font-semibold uppercase tracking-wide">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {result.status === 'error' ? 'Compilation Error' : 'Simulation Error'}
                          </div>
                          <button
                            onClick={() => navigator.clipboard?.writeText(result.compilation_error)}
                            className="text-xs text-[#7A8FA8] hover:text-[#E8EDF4] px-2 py-0.5 rounded transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <pre className="font-mono text-xs bg-[#0D0F14] p-4 text-[#FF8080] overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                          {result.compilation_error.replace(/\/tmp\/[^\s/:]*/g, '<tmp>')}
                        </pre>
                      </div>
                    )}

                    {/* Test results */}
                    {result.testcase_results && result.testcase_results.length > 0 && !result.compilation_error && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-[#7A8FA8] uppercase tracking-wide">Test Results</div>
                        {result.testcase_results.map((tc, i) => (
                          <div key={i} className={`flex flex-col gap-1 p-2.5 rounded-lg border text-sm ${
                            tc.passed ? 'bg-[#22C55E]/5 border-[#22C55E]/15' : 'bg-[#EF4444]/5 border-[#EF4444]/15'
                          }`}>
                            <div className="flex items-center gap-2">
                              {tc.passed
                                ? <CheckCircle className="w-4 h-4 text-[#22C55E] shrink-0" />
                                : <XCircle className="w-4 h-4 text-[#EF4444] shrink-0" />}
                              <span className={tc.passed ? 'text-[#22C55E]' : 'text-[#EF4444]'}>Test {i + 1}</span>
                              {tc.output && (
                                <span className="text-[#7A8FA8] font-mono text-xs ml-auto">
                                  Output: <span className="text-[#C8D4E0]">{tc.output.trim()}</span>
                                </span>
                              )}
                            </div>
                            {tc.error && (
                              <pre className="ml-6 text-xs font-mono text-[#EF4444] whitespace-pre-wrap">{tc.error}</pre>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lint warnings */}
                    {result.lint_warnings && result.lint_warnings.length > 0 && (
                      <div className="rounded-xl overflow-hidden border border-[#F59E0B]/25">
                        <div className="px-4 py-2 bg-[#F59E0B]/10 border-b border-[#F59E0B]/20 text-xs font-semibold text-[#F59E0B] uppercase tracking-wide">
                          Lint Warnings ({result.lint_warnings.length})
                        </div>
                        <div className="p-3 space-y-1 max-h-32 overflow-y-auto">
                          {result.lint_warnings.map((w, i) => (
                            <div key={i} className="font-mono text-xs text-[#F59E0B]/80">{w}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Inline Waveform Viewer */}
                    {result.waveform_json && (
                      <WaveformViewer data={result.waveform_json} />
                    )}

                    {/* VCD Download */}
                    {result.submission_id && result.has_waveform && (
                      <a
                        href={`${API}/api/submissions/${result.submission_id}/vcd`}
                        className="flex items-center gap-2 text-xs text-[#4A8FE8] hover:underline"
                        target="_blank" rel="noreferrer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download raw VCD
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Play className="w-10 h-10 text-[#1E2530] mb-3" />
                    <p className="text-[#7A8FA8] text-sm">Submit your code to see results</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 flex flex-col" style={{ minHeight: '500px' }}>
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#13171E] border-b border-[#1E2530]">
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs font-medium text-[#C8D4E0] bg-[#1A1F28] border border-[#1E2530] hover:border-[#4A8FE8] px-3 py-1.5 rounded-lg transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4A8FE8]"></span>
                {LANGUAGES.find(l => l.value === language)?.label || 'Verilog'}
                <ChevronDown className="w-3.5 h-3.5 text-[#7A8FA8]" />
              </button>
              {langMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-44 bg-[#1A1F28] border border-[#1E2530] rounded-lg shadow-xl z-50 overflow-hidden">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang.value}
                      onClick={() => !lang.disabled && handleLanguageChange(lang.value)}
                      disabled={lang.disabled}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                        lang.disabled
                          ? 'text-[#4A5568] cursor-not-allowed'
                          : language === lang.value
                            ? 'text-[#4A8FE8] bg-[#4A8FE8]/10'
                            : 'text-[#C8D4E0] hover:bg-[#13171E]'
                      }`}
                    >
                      {lang.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#4A8FE8] hover:bg-[#3B7ACC] disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {submitting ? 'Running...' : 'Submit'}
            </button>
          </div>

          {/* Monaco Editor */}
          <div className="flex-1">
            <Editor
              height="100%"
              language={LANGUAGES.find(l => l.value === language)?.monacoLang || 'verilog'}
              value={code}
              onChange={val => setCode(val || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                renderLineHighlight: 'line',
                automaticLayout: true,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
