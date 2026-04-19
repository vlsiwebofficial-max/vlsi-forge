import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, useAuth } from '../App';
import Navbar from '../components/Navbar';
import SignupModal from '../components/SignupModal';
import Editor from '@monaco-editor/react';
import {
  Play, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle,
  Loader2, Download, ChevronDown, ZoomIn, ZoomOut,
  Lock, MessageCircle, BookOpen,
  Send, Lightbulb, ArrowRight,
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

// ─── Parse ports from starter_code ────────────────────────────────────────────
function parsePorts(starterCode) {
  if (!starterCode) return [];
  // Match: input/output [width] name1, name2
  const portRe = /\b(input|output)\s+(?:reg\s+)?(?:\[([^\]]+)\]\s+)?([a-zA-Z_][a-zA-Z0-9_,\s]*?)(?=\s*[,;)]|\s*\/\/)/g;
  const ports = [];
  let m;
  while ((m = portRe.exec(starterCode)) !== null) {
    const dir   = m[1];
    const width = m[2] ? m[2].trim() : '1';
    const names = m[3].split(',').map(n => n.trim()).filter(Boolean);
    names.forEach(name => {
      if (name && !name.includes('(') && !name.includes(')')) {
        ports.push({ dir, width: width === '1' ? '1-bit' : `[${width}]`, name });
      }
    });
  }
  return ports;
}

// ─── Block Diagram SVG ────────────────────────────────────────────────────────
function BlockDiagram({ ports, title }) {
  const inputs  = ports.filter(p => p.dir === 'input');
  const outputs = ports.filter(p => p.dir === 'output');
  const maxRows = Math.max(inputs.length, outputs.length, 1);
  const BOX_W = 140, ROW_H = 32, PAD_V = 24, LABEL_W = 110;
  const boxH = maxRows * ROW_H + PAD_V * 2;
  const totalW = LABEL_W * 2 + BOX_W + 60;
  const totalH = boxH + 20;
  const boxX = LABEL_W + 30;
  const boxY = 10;
  const midY = (row) => boxY + PAD_V + row * ROW_H + ROW_H / 2;

  return (
    <svg width={totalW} height={totalH} viewBox={`0 0 ${totalW} ${totalH}`} className="w-full max-w-full" style={{ maxHeight: 240 }}>
      {/* Module box */}
      <rect x={boxX} y={boxY} width={BOX_W} height={boxH} rx="8"
        fill="#F8F8F8" stroke="#D0D0D0" strokeWidth="1.5"/>
      <text x={boxX + BOX_W / 2} y={boxY + 14} textAnchor="middle"
        fontSize="9" fontWeight="bold" fill="#888888" fontFamily="monospace">
        MODULE
      </text>
      <text x={boxX + BOX_W / 2} y={boxY + 26} textAnchor="middle"
        fontSize="10" fontWeight="bold" fill="#333333" fontFamily="monospace">
        {title?.replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'dut'}
      </text>

      {/* Input ports */}
      {inputs.map((p, i) => {
        const y = midY(i);
        const portX = boxX;
        return (
          <g key={`in-${i}`}>
            <line x1={LABEL_W} y1={y} x2={portX} y2={y} stroke="#2563EB" strokeWidth="1.5"/>
            <circle cx={portX} cy={y} r="3" fill="#2563EB"/>
            <text x={LABEL_W - 4} y={y + 4} textAnchor="end" fontSize="9"
              fill="#333333" fontFamily="monospace">{p.name}</text>
            <text x={LABEL_W - 4} y={y - 5} textAnchor="end" fontSize="7"
              fill="#AAAAAA" fontFamily="monospace">{p.width}</text>
          </g>
        );
      })}

      {/* Output ports */}
      {outputs.map((p, i) => {
        const y = midY(i);
        const portX = boxX + BOX_W;
        return (
          <g key={`out-${i}`}>
            <line x1={portX} y1={y} x2={portX + LABEL_W - 10} y2={y} stroke="#16A34A" strokeWidth="1.5"/>
            <polygon
              points={`${portX + LABEL_W - 10},${y} ${portX + LABEL_W - 18},${y - 4} ${portX + LABEL_W - 18},${y + 4}`}
              fill="#16A34A"/>
            <text x={portX + 8} y={y + 4} textAnchor="start" fontSize="9"
              fill="#333333" fontFamily="monospace">{p.name}</text>
            <text x={portX + 8} y={y - 5} textAnchor="start" fontSize="7"
              fill="#AAAAAA" fontFamily="monospace">{p.width}</text>
          </g>
        );
      })}

      {/* IN / OUT labels */}
      {inputs.length > 0 && (
        <text x={LABEL_W / 2} y={boxY + boxH / 2 + 4} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill="#BBBBBB" letterSpacing="2">IN</text>
      )}
      {outputs.length > 0 && (
        <text x={boxX + BOX_W + LABEL_W / 2 + 20} y={boxY + boxH / 2 + 4} textAnchor="middle"
          fontSize="8" fontWeight="bold" fill="#BBBBBB" letterSpacing="2">OUT</text>
      )}
    </svg>
  );
}

// ─── Simple inline-markdown renderer ─────────────────────────────────────────
function MarkdownText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const elements = [];
  let inList = false;
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1 my-2 pl-4">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#CCCCCC] shrink-0"/>
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const renderInline = (str) => {
    const parts = str.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} className="font-semibold text-[#111111]">{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={i} className="font-mono text-xs bg-[#F0F4FF] text-[#2563EB] px-1.5 py-0.5 rounded">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(trimmed.slice(2));
    } else {
      if (inList) flushList();
      if (trimmed === '') {
        elements.push(<div key={idx} className="h-2"/>);
      } else {
        elements.push(
          <p key={idx} className="text-sm text-[#333333] leading-relaxed">{renderInline(trimmed)}</p>
        );
      }
    }
  });
  if (inList) flushList();
  return <div className="space-y-1">{elements}</div>;
}

// ─── Explanation markdown renderer (supports headers + code blocks) ───────────
function ExplanationContent({ text }) {
  if (!text) return null;

  // Split on code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-4 text-sm text-[#333333] leading-relaxed">
      {segments.map((seg, i) => {
        if (seg.startsWith('```')) {
          const lines = seg.split('\n');
          const lang = lines[0].replace('```', '').trim() || 'verilog';
          const code = lines.slice(1, -1).join('\n');
          return (
            <div key={i} className="rounded-xl overflow-hidden border border-[#E8E8E8]">
              <div className="flex items-center justify-between px-3.5 py-2 bg-[#252526] border-b border-[#333]">
                <span className="text-xs font-mono text-[#888888]">{lang}</span>
                <button onClick={() => navigator.clipboard?.writeText(code)}
                  className="text-xs text-[#666666] hover:text-[#CCCCCC]">Copy</button>
              </div>
              <pre className="font-mono text-xs bg-[#1e1e1e] text-[#D4D4D4] p-4 overflow-x-auto whitespace-pre leading-relaxed">{code}</pre>
            </div>
          );
        }
        // Inline text — handle bold headers like **1. Key Insight**
        const lines = seg.split('\n');
        return (
          <div key={i} className="space-y-2">
            {lines.map((line, li) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={li} className="h-1"/>;
              // Numbered bold headers: **1. Title**
              if (/^\*\*\d+\.\s/.test(trimmed)) {
                const inner = trimmed.replace(/^\*\*/, '').replace(/\*\*$/, '');
                return (
                  <h3 key={li} className="font-bold text-[#111111] text-[14px] mt-4 pt-3 border-t border-[#F0F0F0] first:mt-0 first:pt-0 first:border-0">
                    {inner}
                  </h3>
                );
              }
              if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                return (
                  <div key={li} className="flex items-start gap-2 pl-2">
                    <span className="mt-2 w-1 h-1 rounded-full bg-[#CCCCCC] shrink-0"/>
                    <span>{trimmed.slice(2)}</span>
                  </div>
                );
              }
              // Inline bold / code
              const parts = trimmed.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
              return (
                <p key={li}>{parts.map((part, pi) => {
                  if (part.startsWith('**') && part.endsWith('**'))
                    return <strong key={pi} className="font-semibold text-[#111111]">{part.slice(2, -2)}</strong>;
                  if (part.startsWith('`') && part.endsWith('`'))
                    return <code key={pi} className="font-mono text-xs bg-[#F0F4FF] text-[#2563EB] px-1 py-0.5 rounded">{part.slice(1, -1)}</code>;
                  return part;
                })}</p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

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

// (Status styles used inline in Result tab)

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProblemDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [problem,    setProblem]    = useState(null);
  const [code,       setCode]       = useState('');
  const [language,   setLanguage]   = useState('verilog');
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result,     setResult]     = useState(null);
  const [activeTab,  setActiveTab]  = useState('description');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [saveStatus,   setSaveStatus]   = useState(null);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Adjacent navigation
  const [adjacent, setAdjacent] = useState(null);

  // Explanation tab
  const [explanation,     setExplanation]     = useState(null); // null=not loaded, string=loaded
  const [explanationLoad, setExplanationLoad] = useState(false);
  const [explanationErr,  setExplanationErr]  = useState('');

  // AI Assistant tab
  const [aiMessages,  setAiMessages]  = useState([]); // [{role, content}]
  const [aiInput,     setAiInput]     = useState('');
  const [aiStreaming, setAiStreaming]  = useState(false);
  const aiEndRef = useRef(null);

  // Panel resize state
  const [leftPct,   setLeftPct]   = useState(42);
  const isDragging   = useRef(false);
  const dragStartX   = useRef(0);
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

  // ── Load problem + saved code + adjacent ──────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setResult(null);
    setExplanation(null);
    setExplanationErr('');
    setAiMessages([]);
    const fetches = [axios.get(`${API}/api/problems/${id}`)];
    if (user) fetches.push(axios.get(`${API}/api/user-code/${id}`, { withCredentials: true }));

    Promise.allSettled(fetches).then(([pR, cR]) => {
      if (pR.status === 'rejected') { navigate('/problems'); return; }
      const prob = pR.value.data;
      setProblem(prob);
      if (cR && cR.status === 'fulfilled' && cR.value.data?.code) {
        setCode(cR.value.data.code);
        if (cR.value.data.language) { setLanguage(cR.value.data.language); langRef.current = cR.value.data.language; }
      } else {
        setCode(prob.starter_code || DEFAULT_CODE.verilog);
      }
    }).finally(() => setLoading(false));

    // Fetch adjacent problems (no auth required)
    axios.get(`${API}/api/problems/${id}/adjacent`)
      .then(r => setAdjacent(r.data))
      .catch(() => setAdjacent(null));
  }, [id, navigate, user]);

  // ── Auto-scroll AI chat ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'ai') aiEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, activeTab]);

  // ── Load explanation when tab first opened ────────────────────────────────
  useEffect(() => {
    if (activeTab === 'explanation' && explanation === null && user && !explanationLoad) {
      setExplanationLoad(true);
      setExplanationErr('');
      axios.get(`${API}/api/problems/${id}/explanation`, { withCredentials: true })
        .then(r => setExplanation(r.data.explanation))
        .catch(err => {
          const detail = err.response?.data?.detail || 'Failed to load explanation.';
          setExplanationErr(detail);
        })
        .finally(() => setExplanationLoad(false));
    }
  }, [activeTab, explanation, id, user, explanationLoad]);

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
    if (!user) { setShowSignupModal(true); return; }
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    saveCode(code, language);
    setSubmitting(true); setResult(null); setActiveTab('result');
    try {
      const res = await axios.post(`${API}/api/submissions`, { problem_id: id, code, language }, { withCredentials: true });
      setResult(res.data);
      // Invalidate explanation cache so it reloads fresh after first submit
      setExplanation(null);
      setExplanationErr('');
    } catch (err) {
      setResult({ status: 'error', compilation_error: err.response?.data?.detail || 'Submission failed.' });
    } finally {
      setSubmitting(false);
    }
  }, [id, code, language, saveCode, user]);

  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);

  // ── Ctrl+Enter ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (!submitting) submitRef.current?.(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [submitting]);

  // ── AI chat send ──────────────────────────────────────────────────────────
  const handleAiSend = useCallback(async () => {
    const msg = aiInput.trim();
    if (!msg || aiStreaming) return;
    setAiInput('');
    const userMsg = { role: 'user', content: msg };
    setAiMessages(prev => [...prev, userMsg, { role: 'assistant', content: '' }]);
    setAiStreaming(true);

    try {
      const response = await fetch(`${API}/api/problems/${id}/hint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, message: msg }),
      });

      if (!response.ok) throw new Error('AI request failed');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const chunk = line.slice(6);
          if (chunk === '[DONE]') break;
          const text = chunk.replace(/<br>/g, '\n');
          setAiMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + text,
            };
            return updated;
          });
        }
      }
    } catch (err) {
      setAiMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' };
        return updated;
      });
    } finally {
      setAiStreaming(false);
    }
  }, [aiInput, aiStreaming, code, id]);

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

  // Guest trying to open a Medium/Hard problem → locked screen
  const isLocked = !user && problem.difficulty !== 'Easy';
  if (isLocked) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#F0F0F0] flex items-center justify-center mx-auto mb-6">
          <Lock className="w-7 h-7 text-[#AAAAAA]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[#111111] tracking-tight mb-2">{problem.title}</h1>
        <div className="flex items-center justify-center gap-2 mb-6">
          {problem.difficulty && (() => { const d = DIFF_STYLE[problem.difficulty] || {}; return (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${d.text} ${d.bg} ${d.border}`}>{problem.difficulty}</span>
          );})()}
        </div>
        <p className="text-[#888888] text-sm leading-relaxed mb-8">
          Medium and Hard problems require a free account. Sign up to unlock this problem and track your progress.
        </p>
        <Link to="/register" className="inline-block bg-[#111111] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#2A2A2A] shadow-btn mb-3 transition-colors">
          Create free account
        </Link>
        <div className="text-sm text-[#888888]">
          Already have one? <Link to="/login" className="text-[#111111] font-semibold hover:underline">Sign in</Link>
        </div>
        <div className="mt-8">
          <Link to="/problems" className="text-xs text-[#AAAAAA] hover:text-[#666666] transition-colors">
            ← Browse free Easy problems
          </Link>
        </div>
      </div>
    </div>
  );

  const ds  = DIFF_STYLE[problem.difficulty] || {};
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const shortcutLabel = isMac ? '⌘↵' : '⌃↵';

  const ports = parsePorts(problem.starter_code || '');

  // Tabs — Explanation + AI only for authenticated users
  const TABS = user ? [
    { id: 'description', label: 'Description' },
    { id: 'testcases',   label: 'Test Cases' },
    { id: 'result',      label: 'Result' },
    { id: 'explanation', label: 'Explanation' },
    { id: 'ai',          label: 'AI Assistant' },
  ] : [
    { id: 'description', label: 'Description' },
    { id: 'testcases',   label: 'Test Cases' },
    { id: 'result',      label: 'Result' },
  ];

  return (
    <>
    {showSignupModal && (
      <SignupModal
        onClose={() => setShowSignupModal(false)}
        problemTitle={problem.title}
      />
    )}
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
          <div className="px-4 py-3 border-b border-[#EFEFEF] bg-white shrink-0">
            {/* Navigation row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <Link to="/problems" className="text-[#CCCCCC] hover:text-[#555555] p-0.5 rounded hover:bg-[#F5F5F5] shrink-0">
                <ChevronLeft className="w-4 h-4"/>
              </Link>

              {/* Prev / Next in domain */}
              <div className="flex items-center gap-1 flex-1 justify-end">
                {adjacent?.domain && (
                  <span className="text-[10px] text-[#CCCCCC] font-medium hidden sm:block mr-1 truncate max-w-[100px]">
                    {adjacent.position}/{adjacent.total} in {adjacent.domain}
                  </span>
                )}
                <button
                  onClick={() => adjacent?.prev_id && navigate(`/problems/${adjacent.prev_id}`)}
                  disabled={!adjacent?.prev_id}
                  title={adjacent?.prev_title || 'No previous problem'}
                  className="p-1 rounded-lg border border-[#E8E8E8] bg-white disabled:opacity-30 hover:enabled:bg-[#F5F5F5] hover:enabled:border-[#D0D0D0] transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-[#555555]"/>
                </button>
                <button
                  onClick={() => adjacent?.next_id && navigate(`/problems/${adjacent.next_id}`)}
                  disabled={!adjacent?.next_id}
                  title={adjacent?.next_title || 'No next problem'}
                  className="p-1 rounded-lg border border-[#E8E8E8] bg-white disabled:opacity-30 hover:enabled:bg-[#F5F5F5] hover:enabled:border-[#D0D0D0] transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-[#555555]"/>
                </button>
              </div>
            </div>

            {/* Title + badges */}
            <h1 className="text-[14px] font-bold text-[#111111] tracking-tight leading-snug mb-1.5">{problem.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {problem.difficulty && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${ds.text} ${ds.bg} ${ds.border}`}>{problem.difficulty}</span>
              )}
              {problem.domain && (
                <span className="text-[11px] text-[#888888] bg-[#F8F8F8] border border-[#E8E8E8] px-2 py-0.5 rounded-md">{problem.domain}</span>
              )}
              {(problem.tags||[]).slice(0, 3).map(t => (
                <span key={t} className="text-[11px] text-[#888888] bg-[#F8F8F8] border border-[#E8E8E8] px-2 py-0.5 rounded-md font-mono">{t}</span>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#EFEFEF] px-2 bg-white shrink-0 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 py-3 text-[12px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === tab.id ? 'text-[#111111]' : 'text-[#999999] hover:text-[#555555]'
                }`}
              >
                {tab.id === 'ai' && <MessageCircle className="w-3 h-3"/>}
                {tab.id === 'explanation' && <BookOpen className="w-3 h-3"/>}
                {tab.label}
                {tab.id === 'result' && result && (
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${result.status==='passed'?'bg-[#16A34A]':'bg-[#DC2626]'}`}/>
                )}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#111111] rounded-t-full"/>
                )}
              </button>
            ))}
          </div>

          {/* Tab panels */}
          <div className="flex-1 relative overflow-hidden">

            {/* ── Description ─────────────────────────────────────────── */}
            <div className={`absolute inset-0 overflow-y-auto ${activeTab!=='description'?'hidden':''}`}>
              <div className="p-5 space-y-5">

                {/* Overview */}
                <section>
                  <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-3">Overview</p>
                  <MarkdownText text={problem.description}/>
                </section>

                {/* Interface / Port Table */}
                {ports.length > 0 && (
                  <section>
                    <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-3">Interface</p>
                    <div className="rounded-xl border border-[#E8E8E8] overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#FAFAFA] border-b border-[#E8E8E8]">
                            <th className="text-left px-3.5 py-2 font-semibold text-[#888888] w-1/3">Port</th>
                            <th className="text-left px-3.5 py-2 font-semibold text-[#888888] w-1/5">Dir</th>
                            <th className="text-left px-3.5 py-2 font-semibold text-[#888888]">Width</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F5F5F5]">
                          {ports.map((p, i) => (
                            <tr key={i} className="hover:bg-[#FAFAFA]">
                              <td className="px-3.5 py-2 font-mono text-[#111111] font-semibold">{p.name}</td>
                              <td className="px-3.5 py-2">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  p.dir === 'input'
                                    ? 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]'
                                    : 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
                                }`}>
                                  {p.dir === 'input' ? '→' : '←'} {p.dir}
                                </span>
                              </td>
                              <td className="px-3.5 py-2 font-mono text-[#888888]">{p.width}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* Block Diagram */}
                {ports.length > 0 && (
                  <section>
                    <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-3">Block Diagram</p>
                    <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-4 overflow-x-auto">
                      <BlockDiagram ports={ports} title={problem.title}/>
                    </div>
                  </section>
                )}

                {/* Constraints */}
                {problem.constraints && (
                  <section>
                    <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-3">Constraints</p>
                    <div className="bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3.5">
                      <MarkdownText text={problem.constraints}/>
                    </div>
                  </section>
                )}

                {/* Companies */}
                {(problem.companies||[]).length > 0 && (
                  <section>
                    <p className="text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase mb-2.5">Asked by</p>
                    <div className="flex flex-wrap gap-2">
                      {problem.companies.map(c => (
                        <span key={c} className="text-xs font-semibold text-[#555555] bg-[#F5F5F5] border border-[#E8E8E8] px-2.5 py-1 rounded-lg">{c}</span>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            {/* ── Test Cases ──────────────────────────────────────────── */}
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

            {/* ── Result ──────────────────────────────────────────────── */}
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
                    <div className="flex-1 min-w-0">
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
                    {/* After first submission, nudge to explanation */}
                    {user && (
                      <button
                        onClick={() => setActiveTab('explanation')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#555555] hover:text-[#111111] px-2.5 py-1.5 rounded-lg border border-[#E8E8E8] bg-white hover:bg-[#F5F5F5] transition-colors shrink-0"
                      >
                        <BookOpen className="w-3 h-3"/> Explanation
                      </button>
                    )}
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

            {/* ── Explanation ─────────────────────────────────────────── */}
            {user && (
              <div className={`absolute inset-0 overflow-y-auto p-5 ${activeTab!=='explanation'?'hidden':''}`}>
                {explanationLoad ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                    <div className="w-8 h-8 rounded-full border-2 border-[#E8E8E8] border-t-[#111111] animate-spin"/>
                    <p className="text-xs text-[#AAAAAA]">Generating explanation…</p>
                  </div>
                ) : explanationErr ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-6 h-6 text-[#DC2626]"/>
                    </div>
                    <p className="text-[#555555] text-sm font-semibold mb-1">
                      {explanationErr.includes('Submit') ? 'Submit first to unlock' : 'Explanation unavailable'}
                    </p>
                    <p className="text-[#AAAAAA] text-xs mt-1 mb-5 max-w-xs leading-relaxed">{explanationErr}</p>
                    {explanationErr.includes('Submit') && (
                      <button
                        onClick={handleSubmit}
                        className="inline-flex items-center gap-1.5 bg-[#111111] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2A2A2A] shadow-btn"
                      >
                        <Play className="w-3.5 h-3.5"/> Submit your code
                      </button>
                    )}
                  </div>
                ) : explanation ? (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-7 h-7 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center">
                        <BookOpen className="w-3.5 h-3.5 text-[#16A34A]"/>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#111111]">Solution Walkthrough</p>
                        <p className="text-[10px] text-[#AAAAAA]">AI-generated explanation</p>
                      </div>
                    </div>
                    <ExplanationContent text={explanation}/>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] flex items-center justify-center mb-4">
                      <BookOpen className="w-6 h-6 text-[#CCCCCC]"/>
                    </div>
                    <p className="text-[#555555] text-sm font-semibold">Solution Explanation</p>
                    <p className="text-[#AAAAAA] text-xs mt-1 mb-5">Submit your code first to unlock the walkthrough</p>
                    <button
                      onClick={handleSubmit}
                      className="inline-flex items-center gap-1.5 bg-[#111111] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#2A2A2A] shadow-btn"
                    >
                      <Play className="w-3.5 h-3.5"/> Submit your code
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── AI Assistant ─────────────────────────────────────────── */}
            {user && (
              <div className={`absolute inset-0 flex flex-col ${activeTab!=='ai'?'hidden':''}`}>
                {/* Chat history */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {aiMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F0F4FF] to-[#E0ECFF] border border-[#BFDBFE] flex items-center justify-center mb-3">
                        <Lightbulb className="w-5 h-5 text-[#2563EB]"/>
                      </div>
                      <p className="text-[#555555] text-sm font-semibold">AI Hint Assistant</p>
                      <p className="text-[#AAAAAA] text-xs mt-1 leading-relaxed max-w-[220px]">Ask for a hint, explain what you've tried, or share your code to get targeted feedback.</p>
                      {/* Suggested prompts */}
                      <div className="mt-4 space-y-2 w-full max-w-xs">
                        {[
                          "Give me a hint to get started",
                          "What approach should I use?",
                          "Review my current code",
                        ].map((prompt) => (
                          <button
                            key={prompt}
                            onClick={() => setAiInput(prompt)}
                            className="w-full text-left text-xs text-[#555555] bg-[#FAFAFA] border border-[#E8E8E8] px-3 py-2 rounded-xl hover:bg-white hover:border-[#D0D0D0] transition-colors flex items-center justify-between group"
                          >
                            {prompt}
                            <ArrowRight className="w-3 h-3 text-[#CCCCCC] group-hover:text-[#888888]"/>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-6 h-6 rounded-lg bg-[#F0F4FF] border border-[#BFDBFE] flex items-center justify-center mr-2 mt-0.5 shrink-0">
                          <Lightbulb className="w-3 h-3 text-[#2563EB]"/>
                        </div>
                      )}
                      <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-[#111111] text-white rounded-br-sm'
                          : 'bg-[#F5F5F5] border border-[#E8E8E8] text-[#333333] rounded-bl-sm'
                      }`}>
                        {msg.content || (aiStreaming && i === aiMessages.length - 1 ? (
                          <span className="flex items-center gap-1">
                            <span className="w-1 h-1 bg-[#888888] rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                            <span className="w-1 h-1 bg-[#888888] rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                            <span className="w-1 h-1 bg-[#888888] rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                          </span>
                        ) : '')}
                      </div>
                    </div>
                  ))}
                  <div ref={aiEndRef}/>
                </div>

                {/* Input bar */}
                <div className="shrink-0 px-3 py-3 border-t border-[#EFEFEF] bg-white">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiSend(); } }}
                      placeholder="Ask for a hint… (Enter to send, Shift+Enter for newline)"
                      rows={2}
                      className="flex-1 resize-none text-xs bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl px-3 py-2.5 text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all leading-relaxed"
                    />
                    <button
                      onClick={handleAiSend}
                      disabled={!aiInput.trim() || aiStreaming}
                      className="p-2.5 bg-[#111111] hover:bg-[#2A2A2A] disabled:opacity-40 text-white rounded-xl transition-colors shrink-0"
                    >
                      {aiStreaming ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#CCCCCC] mt-1.5 text-center">AI gives hints, not full solutions</p>
                </div>
              </div>
            )}
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
    </>
  );
}
