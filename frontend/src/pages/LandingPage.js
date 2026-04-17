import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Zap, Code2, CheckCircle, BookOpen, Trophy, ArrowRight, Terminal } from 'lucide-react';
import { useAuth } from '../App';

const features = [
  {
    icon: <Terminal className="w-5 h-5" />,
    title: 'Real Simulation Engine',
    desc: 'Every submission compiles and runs through Icarus Verilog. Real errors, real feedback — no shortcuts.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Instant Results',
    desc: 'Know within seconds if your RTL passes hidden test cases. Waveform viewer included.',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: '33 Curated Problems',
    desc: 'From half adders to pipelined CPUs — covering RTL, Verification, Architecture, and Debug.',
  },
  {
    icon: <Trophy className="w-5 h-5" />,
    title: 'Track Your Progress',
    desc: 'Solved count, acceptance rate, and per-domain progress — all saved to your account.',
  },
];

const DOMAINS = [
  { label: 'RTL Design', count: 20, color: '#2563EB' },
  { label: 'Design Verification', count: 5, color: '#16A34A' },
  { label: 'Computer Architecture', count: 6, color: '#9333EA' },
  { label: 'Debug & Analysis', count: 5, color: '#D97706' },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="border-b border-[#E8E8E8] sticky top-0 z-50 bg-white/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#111111] rounded-md flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#111111] text-[15px] tracking-tight">VLSI Forge</span>
            <span className="text-[10px] bg-[#F5F5F5] text-[#888888] border border-[#E8E8E8] px-1.5 py-0.5 rounded font-semibold tracking-wide">BETA</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="text-sm font-medium bg-[#111111] text-white px-4 py-1.5 rounded-md hover:bg-[#333333] transition-colors flex items-center gap-1.5">
                Dashboard <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-[#555555] hover:text-[#111111] px-3 py-1.5 rounded-md hover:bg-[#F5F5F5] transition-colors">Sign in</Link>
                <Link to="/register" className="text-sm font-medium bg-[#111111] text-white px-4 py-1.5 rounded-md hover:bg-[#333333] transition-colors">Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-20">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-[#F5F5F5] border border-[#E8E8E8] text-[#555555] text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></span>
            Powered by Icarus Verilog — open-source, production-grade
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-[#111111] leading-[1.08] tracking-tight mb-6">
            The practice platform<br />for RTL engineers.
          </h1>
          <p className="text-[#666666] text-lg leading-relaxed mb-10 max-w-xl">
            Write Verilog, SystemVerilog, and VHDL in a real simulation environment. Sharpen your hardware design skills — one problem at a time.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to={user ? '/problems' : '/register'}
              className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#333333] text-white font-semibold px-6 py-2.5 rounded-md transition-colors text-sm"
            >
              Start solving <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 bg-white hover:bg-[#F5F5F5] text-[#111111] font-semibold px-6 py-2.5 rounded-md transition-colors text-sm border border-[#E8E8E8]"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-10 mt-16 pt-10 border-t border-[#E8E8E8]">
          {[
            { value: '33', label: 'Problems' },
            { value: '5', label: 'Domains' },
            { value: '100%', label: 'Real simulation' },
            { value: 'Free', label: 'Always' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-2xl font-bold text-[#111111] tracking-tight">{value}</div>
              <div className="text-sm text-[#888888] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Domain tiles ───────────────────────────────────────── */}
      <section className="bg-[#FAFAFA] border-y border-[#E8E8E8] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#AAAAAA] uppercase mb-2">Practice tracks</p>
              <h2 className="text-2xl font-bold text-[#111111] tracking-tight">Four domains. One platform.</h2>
            </div>
            <Link to={user ? '/problems' : '/register'} className="text-sm font-medium text-[#111111] hover:underline flex items-center gap-1">
              Browse all problems <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {DOMAINS.map(({ label, count, color }) => (
              <div key={label} className="bg-white border border-[#E8E8E8] rounded-xl p-5 hover:border-[#D0D0D0] hover:shadow-sm transition-all">
                <div className="w-2 h-2 rounded-full mb-4" style={{ backgroundColor: color }} />
                <div className="text-xl font-bold text-[#111111] tracking-tight">{count}</div>
                <div className="text-sm font-medium text-[#111111] mt-0.5">{label}</div>
                <div className="text-xs text-[#AAAAAA] mt-1">problems</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <p className="text-xs font-semibold tracking-widest text-[#AAAAAA] uppercase mb-2">Why VLSI Forge</p>
          <h2 className="text-2xl font-bold text-[#111111] tracking-tight">Built for serious engineers.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {features.map((f) => (
            <div key={f.title} className="group border border-[#E8E8E8] rounded-xl p-6 hover:border-[#111111] hover:shadow-sm transition-all bg-white">
              <div className="w-9 h-9 rounded-lg bg-[#F5F5F5] flex items-center justify-center mb-4 group-hover:bg-[#111111] transition-colors">
                <span className="text-[#555555] group-hover:text-white transition-colors">{f.icon}</span>
              </div>
              <h3 className="text-[#111111] font-semibold mb-2 text-[15px]">{f.title}</h3>
              <p className="text-[#666666] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Code preview strip ─────────────────────────────────── */}
      <section className="bg-[#111111] py-16">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="lg:w-1/2">
              <p className="text-xs font-semibold tracking-widest text-[#666666] uppercase mb-3">Real editor. Real compiler.</p>
              <h2 className="text-2xl font-bold text-white tracking-tight mb-4">Write code. Get instant feedback.</h2>
              <p className="text-[#AAAAAA] text-sm leading-relaxed mb-6">
                Monaco editor with Verilog syntax highlighting. Your submission compiles on the server and results come back in seconds — pass/fail per test case, waveform viewer, lint warnings.
              </p>
              <Link
                to={user ? '/problems' : '/register'}
                className="inline-flex items-center gap-2 bg-white text-[#111111] font-semibold px-5 py-2.5 rounded-md hover:bg-[#F5F5F5] transition-colors text-sm"
              >
                Try a problem <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="lg:w-1/2 w-full">
              <div className="rounded-xl border border-[#333333] overflow-hidden">
                <div className="bg-[#1A1A1A] border-b border-[#333333] px-4 py-2.5 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
                    <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
                    <div className="w-3 h-3 rounded-full bg-[#28C840]" />
                  </div>
                  <span className="text-[#666666] text-xs font-mono ml-2">half_adder.v</span>
                </div>
                <div className="bg-[#1E1E1E] p-5 font-mono text-sm leading-6">
                  <div><span className="text-[#569CD6]">module</span> <span className="text-[#4EC9B0]">half_adder</span><span className="text-[#D4D4D4]">(</span></div>
                  <div className="pl-4"><span className="text-[#569CD6]">input</span>  <span className="text-[#9CDCFE]">a</span><span className="text-[#D4D4D4]">, </span><span className="text-[#9CDCFE]">b</span><span className="text-[#D4D4D4]">,</span></div>
                  <div className="pl-4"><span className="text-[#569CD6]">output</span> <span className="text-[#9CDCFE]">sum</span><span className="text-[#D4D4D4]">, </span><span className="text-[#9CDCFE]">carry</span></div>
                  <div><span className="text-[#D4D4D4]">);</span></div>
                  <div className="pl-4 mt-1"><span className="text-[#569CD6]">assign</span> <span className="text-[#9CDCFE]">sum</span>   <span className="text-[#D4D4D4]">=</span> <span className="text-[#9CDCFE]">a</span> <span className="text-[#D4D4D4]">^</span> <span className="text-[#9CDCFE]">b</span><span className="text-[#D4D4D4]">;</span></div>
                  <div className="pl-4"><span className="text-[#569CD6]">assign</span> <span className="text-[#9CDCFE]">carry</span> <span className="text-[#D4D4D4]">=</span> <span className="text-[#9CDCFE]">a</span> <span className="text-[#D4D4D4]">&</span> <span className="text-[#9CDCFE]">b</span><span className="text-[#D4D4D4]">;</span></div>
                  <div className="mt-1"><span className="text-[#569CD6]">endmodule</span></div>
                  <div className="mt-4 border-t border-[#333333] pt-3 flex items-center gap-2">
                    <CheckCircle className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span className="text-[#16A34A] text-xs font-semibold">4/4 test cases passed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-[#111111] tracking-tight mb-4">Ready to level up your RTL skills?</h2>
        <p className="text-[#666666] mb-8 max-w-md mx-auto">Join engineers who practice VLSI design with real simulation feedback.</p>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 bg-[#111111] hover:bg-[#333333] text-white font-semibold px-7 py-3 rounded-md transition-colors"
        >
          Create free account <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-[#E8E8E8]">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-[#111111] rounded flex items-center justify-center">
              <Cpu className="w-3 h-3 text-white" />
            </div>
            <span className="text-[#888888] text-sm">© 2026 VLSI Forge</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#AAAAAA]">
            <Code2 className="w-3.5 h-3.5" />
            <span>Simulation powered by Icarus Verilog</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
