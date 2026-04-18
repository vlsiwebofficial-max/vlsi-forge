import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Zap, Code2, CheckCircle, BookOpen, Trophy, ArrowRight, Terminal, Shield } from 'lucide-react';
import { useAuth } from '../App';

const FEATURES = [
  {
    icon: <Terminal className="w-4 h-4" />,
    title: 'Real Simulation Engine',
    desc: 'Every submission compiles and runs through Icarus Verilog — real compiler errors, real test case feedback.',
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: 'Instant Results',
    desc: 'Results in seconds. Per-test-case pass/fail, inline waveform viewer, and lint warnings included.',
  },
  {
    icon: <BookOpen className="w-4 h-4" />,
    title: '33 Curated Problems',
    desc: 'RTL Design, Verification, Computer Architecture, and Debug & Analysis — covering the full spectrum.',
  },
  {
    icon: <Trophy className="w-4 h-4" />,
    title: 'Progress Tracking',
    desc: 'Acceptance rate, per-domain solved count, and streak — all synced to your account in real time.',
  },
  {
    icon: <Shield className="w-4 h-4" />,
    title: 'Debug & Analysis Track',
    desc: 'Exclusive VLSI Forge domain — find latches, race conditions, and FSM bugs in broken RTL.',
  },
  {
    icon: <Code2 className="w-4 h-4" />,
    title: 'Code Persistence',
    desc: 'Your code is auto-saved per problem. Reopen any problem and pick up exactly where you left off.',
  },
];

const DOMAINS = [
  { label: 'RTL Design',           count: 20, color: '#2563EB', bg: '#EFF6FF' },
  { label: 'Design Verification',  count: 5,  color: '#16A34A', bg: '#F0FDF4' },
  { label: 'Computer Architecture', count: 6, color: '#9333EA', bg: '#FAF5FF' },
  { label: 'Debug & Analysis',     count: 5,  color: '#D97706', bg: '#FFFBEB' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <nav className="shadow-navbar sticky top-0 z-50 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#111111] rounded-[7px] flex items-center justify-center shadow-btn">
              <Cpu className="w-[15px] h-[15px] text-white" />
            </div>
            <span className="font-bold text-[#111111] text-[15px] tracking-tight">VLSI Forge</span>
            <span className="text-[9px] bg-[#F5F5F5] text-[#999999] border border-[#EBEBEB] px-1.5 py-[3px] rounded font-semibold tracking-widest uppercase">Beta</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="text-sm font-semibold bg-[#111111] text-white px-4 py-1.5 rounded-md hover:bg-[#333333] shadow-btn flex items-center gap-1.5">
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-[#666666] hover:text-[#111111] px-3 py-1.5 rounded-md hover:bg-[#F5F5F5]">Sign in</Link>
                <Link to="/register" className="text-sm font-semibold bg-[#111111] text-white px-4 py-1.5 rounded-md hover:bg-[#333333] shadow-btn">Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#FAFAFA] to-white pointer-events-none" />
        {/* Faint grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #E0E0E0 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          opacity: 0.4,
          maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)',
        }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-20">
          <div className="max-w-3xl animate-fade-up">
            <div className="inline-flex items-center gap-2 bg-white border border-[#E8E8E8] text-[#666666] text-xs font-semibold px-3 py-1.5 rounded-full mb-8 shadow-card">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              Powered by Icarus Verilog — open-source, production-grade
            </div>
            <h1 className="text-[52px] sm:text-[64px] font-extrabold text-[#111111] leading-[1.04] tracking-[-2px] mb-6">
              The practice platform<br />
              <span style={{ background: 'linear-gradient(135deg, #111111 0%, #555555 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                for RTL engineers.
              </span>
            </h1>
            <p className="text-[#666666] text-lg leading-relaxed mb-10 max-w-xl">
              Write Verilog, SystemVerilog, and VHDL in a real simulation environment. Get per-test feedback, waveforms, and lint warnings — instantly.
            </p>
            <div className="flex flex-wrap gap-3 items-center">
              <Link
                to={user ? '/problems' : '/register'}
                className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#2A2A2A] text-white font-semibold px-6 py-2.5 rounded-lg shadow-btn text-sm"
              >
                Start solving free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white hover:bg-[#F8F8F8] text-[#111111] font-semibold px-6 py-2.5 rounded-lg text-sm border border-[#E0E0E0] shadow-card"
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-10 mt-20 pt-10 border-t border-[#EEEEEE]">
            {[
              { value: '33', label: 'Problems' },
              { value: '5',  label: 'Domains' },
              { value: '3',  label: 'Languages' },
              { value: 'Free', label: 'Always' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-extrabold text-[#111111] tracking-tight">{value}</div>
                <div className="text-sm text-[#AAAAAA] mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Domain tiles ───────────────────────────────────────────── */}
      <section className="bg-[#FAFAFA] border-y border-[#EEEEEE] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#BBBBBB] uppercase mb-2">Practice tracks</p>
              <h2 className="text-2xl font-bold text-[#111111] tracking-tight">Four domains. One platform.</h2>
            </div>
            <Link to={user ? '/problems' : '/register'} className="text-sm font-semibold text-[#111111] hover:underline flex items-center gap-1.5">
              Browse all problems <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {DOMAINS.map(({ label, count, color, bg }) => (
              <div key={label} className="bg-white border border-[#EEEEEE] rounded-2xl p-5 shadow-card shadow-card-hover cursor-default">
                <div className="w-8 h-8 rounded-xl mb-4 flex items-center justify-center" style={{ backgroundColor: bg }}>
                  <span className="text-lg font-extrabold tracking-tight" style={{ color }}>{count}</span>
                </div>
                <div className="text-[13px] font-semibold text-[#111111] leading-snug">{label}</div>
                <div className="text-xs text-[#AAAAAA] mt-0.5">problems</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#BBBBBB] uppercase mb-2">Why VLSI Forge</p>
          <h2 className="text-2xl font-bold text-[#111111] tracking-tight">Built for serious engineers.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group bg-white border border-[#EEEEEE] rounded-2xl p-6 shadow-card shadow-card-hover">
              <div className="w-8 h-8 rounded-lg bg-[#F5F5F5] flex items-center justify-center mb-4 group-hover:bg-[#111111]" style={{ transition: 'background 150ms ease' }}>
                <span className="text-[#666666] group-hover:text-white" style={{ transition: 'color 150ms ease' }}>{f.icon}</span>
              </div>
              <h3 className="text-[#111111] font-semibold mb-2 text-sm">{f.title}</h3>
              <p className="text-[#777777] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Code preview ───────────────────────────────────────────── */}
      <section className="bg-[#111111] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2">
              <p className="text-[10px] font-bold tracking-[0.16em] text-[#555555] uppercase mb-3">Real editor · Real compiler</p>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Write code. Get instant feedback.</h2>
              <p className="text-[#888888] text-sm leading-relaxed mb-6">
                Monaco editor with Verilog syntax highlighting. Compiles on the server, results back in seconds — per-test pass/fail, inline waveform viewer, lint warnings, auto-saved code.
              </p>
              <Link
                to={user ? '/problems' : '/register'}
                className="inline-flex items-center gap-2 bg-white text-[#111111] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#F0F0F0] shadow-btn text-sm"
              >
                Try a problem <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="rounded-2xl border border-[#2A2A2A] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
                <div className="bg-[#1A1A1A] border-b border-[#2A2A2A] px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <span className="text-[#555555] text-xs font-mono ml-2">half_adder.v</span>
                  <div className="ml-auto flex items-center gap-1.5 bg-[#28C840]/10 border border-[#28C840]/30 px-2 py-0.5 rounded text-[#28C840] text-[10px] font-semibold">
                    <CheckCircle className="w-3 h-3" /> 4/4 passed
                  </div>
                </div>
                <div className="bg-[#1E1E1E] p-5 font-mono text-sm leading-7">
                  <div><span className="text-[#569CD6]">module</span> <span className="text-[#4EC9B0]">half_adder</span><span className="text-[#D4D4D4]">(</span></div>
                  <div className="pl-4"><span className="text-[#569CD6]">input</span>  <span className="text-[#9CDCFE]">a</span><span className="text-[#D4D4D4]">, </span><span className="text-[#9CDCFE]">b</span><span className="text-[#D4D4D4]">,</span></div>
                  <div className="pl-4"><span className="text-[#569CD6]">output</span> <span className="text-[#9CDCFE]">sum</span><span className="text-[#D4D4D4]">, </span><span className="text-[#9CDCFE]">carry</span></div>
                  <div><span className="text-[#D4D4D4]">);</span></div>
                  <div className="pl-4 mt-1"><span className="text-[#569CD6]">assign</span> <span className="text-[#9CDCFE]">sum</span>   <span className="text-[#D4D4D4]">=</span> <span className="text-[#9CDCFE]">a</span> <span className="text-[#D4D4D4]">^</span> <span className="text-[#9CDCFE]">b</span><span className="text-[#D4D4D4]">;</span></div>
                  <div className="pl-4"><span className="text-[#569CD6]">assign</span> <span className="text-[#9CDCFE]">carry</span> <span className="text-[#D4D4D4]">=</span> <span className="text-[#9CDCFE]">a</span> <span className="text-[#D4D4D4]">&amp;</span> <span className="text-[#9CDCFE]">b</span><span className="text-[#D4D4D4]">;</span></div>
                  <div className="mt-1"><span className="text-[#569CD6]">endmodule</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <h2 className="text-[36px] font-extrabold text-[#111111] tracking-tight mb-4">Ready to level up?</h2>
        <p className="text-[#777777] mb-8 max-w-md mx-auto leading-relaxed">
          Join engineers who practice RTL design with real simulation — not just syntax.
        </p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#2A2A2A] text-white font-semibold px-7 py-3 rounded-lg shadow-btn"
        >
          Create free account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-[#EEEEEE]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#111111] rounded flex items-center justify-center">
              <Cpu className="w-3 h-3 text-white" />
            </div>
            <span className="text-[#AAAAAA] text-sm">© 2026 VLSI Forge</span>
          </div>
          <span className="text-xs text-[#CCCCCC]">Simulation powered by Icarus Verilog</span>
        </div>
      </footer>
    </div>
  );
}
