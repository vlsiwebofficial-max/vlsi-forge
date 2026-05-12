import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import {
  CheckCircle, XCircle, AlertCircle, ChevronLeft,
  Download, Clock, Loader2, ZoomIn, ZoomOut,
} from 'lucide-react';

const statusConfig = {
  passed: {
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-[#16A34A]',
    bg: 'bg-[#F0FDF4] border-[#BBF7D0]',
    label: 'Accepted',
  },
  failed: {
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-[#DC2626]',
    bg: 'bg-[#FEF2F2] border-[#FECACA]',
    label: 'Wrong Answer',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-[#D97706]',
    bg: 'bg-[#FFFBEB] border-[#FDE68A]',
    label: 'Runtime Error',
  },
};

// ── Inline waveform viewer ────────────────────────────────────────────────────
const SIG_COLORS = ['#2563EB','#16A34A','#D97706','#9333EA','#DB2777','#0891B2','#EA580C','#64748B'];

function WaveformViewer({ data }) {
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  if (!data?.signals || !Object.keys(data.signals).length) {
    return (
      <div className="flex items-center justify-center py-6 text-[#AAAAAA] text-xs">
        No waveform data
      </div>
    );
  }

  const signals  = Object.entries(data.signals);
  const maxTime  = data.max_time || 1;
  const timescale = data.timescale || '1ns';
  const LABEL_W  = 88, ROW_H = 30, SIG_H = 18, Y_PAD = (ROW_H - SIG_H) / 2;
  const TICK_COUNT = 8;
  const totalW   = Math.max(400, (containerRef.current?.clientWidth || 640) - LABEL_W - 24);
  const scaledW  = totalW * zoom;
  const totalH   = signals.length * ROW_H + 24;
  const tx       = t => (t / maxTime) * scaledW;

  function buildPath(pts) {
    if (!pts?.length) return '';
    const s = [];
    for (let i = 0; i < pts.length; i++) {
      const [t, v] = pts[i];
      const nxt = i + 1 < pts.length ? pts[i + 1][0] : maxTime;
      const hi  = v === '1' || v === 1 || v === 'H' || v === 'h';
      const y   = hi ? Y_PAD : Y_PAD + SIG_H;
      if (i === 0) s.push(`M ${tx(t)} ${y}`); else s.push(`V ${y}`);
      s.push(`H ${tx(nxt)}`);
    }
    return s.join(' ');
  }

  const ti = maxTime / TICK_COUNT;

  return (
    <div className="rounded-2xl overflow-hidden border border-[#E4E4E4] bg-white shadow-card">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F0] bg-[#FAFAFA]">
        <span className="text-xs font-semibold text-[#111111]">Waveform Viewer</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-[#888888] mr-2">Timescale: {timescale}</span>
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))}
            className="p-1 rounded text-[#888888] hover:text-[#111111] hover:bg-[#F0F0F0]">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(z => Math.min(8, z + 0.5))}
            className="p-1 rounded text-[#888888] hover:text-[#111111] hover:bg-[#F0F0F0]">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-[#555555] ml-1 w-8 text-right font-mono">{zoom}×</span>
        </div>
      </div>
      <div className="overflow-x-auto" ref={containerRef}>
        <div style={{ display: 'flex', minWidth: '100%' }}>
          {/* Signal labels */}
          <div style={{ width: LABEL_W, flexShrink: 0 }}>
            <div style={{ height: 24 }} />
            {signals.map(([name], i) => (
              <div key={name}
                style={{ height: ROW_H, display: 'flex', alignItems: 'center', paddingLeft: 12 }}>
                <span className="text-xs font-mono truncate"
                  style={{ color: SIG_COLORS[i % SIG_COLORS.length] }}
                  title={name}>{name}</span>
              </div>
            ))}
          </div>
          {/* SVG waveform */}
          <div style={{ flex: 1, overflowX: zoom > 1 ? 'auto' : 'visible' }}>
            <svg width={scaledW} height={totalH} style={{ display: 'block' }}>
              {/* Grid lines */}
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => (
                <line key={i} x1={tx(i * ti)} y1={24} x2={tx(i * ti)} y2={totalH}
                  stroke="#F0F0F0" strokeWidth="1" />
              ))}
              {/* Time ticks */}
              {Array.from({ length: TICK_COUNT + 1 }, (_, i) => (
                <g key={i}>
                  <line x1={tx(i * ti)} y1={16} x2={tx(i * ti)} y2={24} stroke="#CCCCCC" strokeWidth="1" />
                  <text x={tx(i * ti)} y={11} textAnchor="middle" fontSize="8" fill="#CCCCCC">
                    {Math.round(i * ti)}
                  </text>
                </g>
              ))}
              {/* Signal waveforms */}
              {signals.map(([name, pts], i) => {
                const c = SIG_COLORS[i % SIG_COLORS.length];
                const p = buildPath(pts);
                return (
                  <g key={name} transform={`translate(0,${24 + i * ROW_H})`}>
                    <rect x={0} y={0} width={scaledW} height={ROW_H} fill="transparent" />
                    {p && <path d={p} stroke={c} strokeWidth="1.5" fill="none" strokeLinejoin="round" />}
                    {pts?.map(([t, v], pi) => {
                      const nxt = pi + 1 < pts.length ? pts[pi + 1][0] : maxTime;
                      const sw  = tx(nxt) - tx(t);
                      if (sw < 16) return null;
                      const hi  = v === '1' || v === 1 || v === 'H' || v === 'h';
                      return (
                        <text key={pi}
                          x={tx(t) + sw / 2}
                          y={hi ? Y_PAD - 1 : Y_PAD + SIG_H + 8}
                          textAnchor="middle" fontSize="7" fill={c} opacity="0.6">
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SubmissionPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/submissions/${id}`, { withCredentials: true })
      .then(res => setSubmission(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#111111] animate-spin" />
      </div>
    </div>
  );

  if (!submission) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="flex items-center justify-center h-64 text-[#888888] text-sm">
        Submission not found.
      </div>
    </div>
  );

  const cfg = statusConfig[submission.status] || statusConfig.error;

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            to={submission.problem_id ? `/problems/${submission.problem_id}` : '/problems'}
            className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-[#111111] transition-colors font-medium"
          >
            <ChevronLeft className="w-4 h-4" /> Back to Problem
          </Link>
          <span className="text-[#DDDDDD]">·</span>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-[#111111] transition-colors font-medium"
          >
            Dashboard
          </Link>
        </div>

        {/* Status Banner */}
        <div className={`flex items-center gap-4 p-5 rounded-2xl border mb-6 ${cfg.bg}`}>
          <span className={cfg.color}>{cfg.icon}</span>
          <div>
            <div className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</div>
            <div className="text-[#666666] text-sm mt-0.5">
              {submission.passed_count}/{submission.total_count} test cases passed
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[#AAAAAA]">
            <Clock className="w-3.5 h-3.5" />
            {new Date(submission.submitted_at).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Test Results */}
          <div className="bg-white border border-[#E4E4E4] rounded-2xl overflow-hidden shadow-card">
            <div className="px-5 py-3.5 border-b border-[#F0F0F0] font-semibold text-[#111111] text-sm">
              Test Case Results
            </div>
            <div className="divide-y divide-[#F5F5F5]">
              {(submission.testcase_results || []).map((tc, i) => (
                <div key={i} className="flex flex-col gap-1.5 px-5 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    {tc.passed
                      ? <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
                      : <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />}
                    <span className={tc.passed ? 'text-[#16A34A] font-medium' : 'text-[#DC2626] font-medium'}>
                      Test {i + 1}
                    </span>
                  </div>
                  {/* Got vs Expected on failure */}
                  {!tc.passed && tc.output != null && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] font-bold text-[#DC2626] uppercase tracking-wide mb-0.5">Got</p>
                        <pre className="font-mono text-xs bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-1.5 text-[#991B1B] overflow-x-auto whitespace-pre-wrap">
                          {tc.output.trim() || '(empty)'}
                        </pre>
                      </div>
                      {tc.expected != null && (
                        <div>
                          <p className="text-[9px] font-bold text-[#16A34A] uppercase tracking-wide mb-0.5">Expected</p>
                          <pre className="font-mono text-xs bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg p-1.5 text-[#166534] overflow-x-auto whitespace-pre-wrap">
                            {tc.expected.trim()}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                  {tc.error && (
                    <pre className="font-mono text-[10px] text-[#DC2626] bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-1.5 overflow-x-auto whitespace-pre-wrap">
                      {tc.error}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right column: errors + actions */}
          <div className="space-y-4">
            {/* Compilation Error */}
            {submission.compilation_error && (
              <div className="bg-white border border-[#FECACA] rounded-2xl overflow-hidden shadow-card">
                <div className="px-5 py-3.5 border-b border-[#FEE2E2] font-semibold text-[#DC2626] text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Compilation Error
                </div>
                <pre className="p-4 font-mono text-xs text-[#DC2626] bg-[#FEF2F2] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {submission.compilation_error}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white border border-[#E4E4E4] rounded-2xl p-5 space-y-3 shadow-card">
              <Link
                to={`/problems/${submission.problem_id}`}
                className="flex items-center justify-center gap-2 w-full bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-semibold py-2.5 rounded-xl shadow-btn transition-colors"
              >
                Back to Problem
              </Link>
              {submission.has_waveform && (
                <a
                  href={`${API}/api/submissions/${id}/vcd`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#FAFAFA] border border-[#E4E4E4] text-[#555555] hover:text-[#111111] hover:border-[#BBBBBB] text-sm font-medium py-2.5 rounded-xl transition-colors"
                >
                  <Download className="w-4 h-4" /> Download VCD
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Inline waveform viewer */}
        {submission.waveform_json && (
          <div className="mt-5">
            <WaveformViewer data={submission.waveform_json} />
          </div>
        )}

        {/* Submitted Code */}
        <div className="mt-5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-3.5 border-b border-[#2A2A2A] font-semibold text-[#CCCCCC] text-sm flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            </div>
            <span className="ml-1">Submitted Code</span>
          </div>
          <pre className="p-5 font-mono text-xs text-[#C8D4E0] overflow-x-auto leading-relaxed">
            {submission.code}
          </pre>
        </div>
      </div>
    </div>
  );
}
