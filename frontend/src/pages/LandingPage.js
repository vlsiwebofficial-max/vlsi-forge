import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Zap, Code2, CheckCircle, BookOpen, Trophy, ArrowRight } from 'lucide-react';
import { useAuth } from '../App';

export default function LandingPage() {
  const { user } = useAuth();

  const features = [
    { icon: <Code2 className="w-6 h-6 text-[#4A8FE8]" />, title: 'Real Verilog Simulation', desc: 'Write Verilog code in our Monaco editor and simulate with Icarus Verilog — instant feedback, real compilation errors.' },
    { icon: <Zap className="w-6 h-6 text-[#22C55E]" />, title: 'Instant Feedback', desc: 'Know within seconds whether your RTL design passes or fails hidden test cases, just like LeetCode.' },
    { icon: <BookOpen className="w-6 h-6 text-[#F59E0B]" />, title: 'Curated Problems', desc: 'From basic gates to complex state machines, FIFOs, and pipelines — problems covering the full RTL design spectrum.' },
    { icon: <Trophy className="w-6 h-6 text-[#A855F7]" />, title: 'Track Progress', desc: 'Your acceptance rate, solved problems, and submission history — all in one dashboard.' },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E14]">
      {/* Navbar */}
      <nav className="bg-[#13171E] border-b border-[#1E2530] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#4A8FE8]" />
            <span className="font-bold text-[#E8EDF4] text-base tracking-tight">VLSI Forge</span>
            <span className="text-xs bg-[#4A8FE8]/15 text-[#4A8FE8] border border-[#4A8FE8]/30 px-2 py-0.5 rounded-full font-semibold">BETA</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard" className="text-sm font-medium bg-[#4A8FE8] text-white px-4 py-1.5 rounded-lg hover:bg-[#3B7ACC] transition-colors flex items-center gap-2">
                Dashboard <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-[#7A8FA8] hover:text-[#E8EDF4] px-3 py-1.5 rounded-lg transition-colors">Sign in</Link>
                <Link to="/register" className="text-sm font-medium bg-[#4A8FE8] text-white px-4 py-1.5 rounded-lg hover:bg-[#3B7ACC] transition-colors">Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#4A8FE8]/10 border border-[#4A8FE8]/25 text-[#4A8FE8] text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
          <Zap className="w-3 h-3" /> Powered by Icarus Verilog
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold text-[#E8EDF4] mb-6 leading-tight tracking-tight">
          LeetCode for<br />
          <span className="text-[#4A8FE8]">RTL Design</span>
        </h1>
        <p className="text-[#7A8FA8] text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Practice Verilog and SystemVerilog with real simulation feedback. Sharpen your RTL skills one problem at a time.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to={user ? "/problems" : "/register"}
            className="inline-flex items-center gap-2 bg-[#4A8FE8] hover:bg-[#3B7ACC] text-white font-semibold px-8 py-3 rounded-xl transition-colors text-base"
          >
            Start Solving <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 bg-[#1A1F28] hover:bg-[#1E2530] text-[#E8EDF4] font-semibold px-8 py-3 rounded-xl transition-colors text-base border border-[#1E2530]"
          >
            Sign In
          </Link>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap justify-center gap-8 mt-14">
          {[['Simulation', 'Real iverilog'], ['Instant', 'Feedback'], ['RTL', 'Focused']].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-[#4A8FE8]">{val}</div>
              <div className="text-sm text-[#7A8FA8]">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <h2 className="text-2xl font-bold text-[#E8EDF4] text-center mb-12 tracking-tight">
          Everything you need to master RTL design
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-[#13171E] border border-[#1E2530] rounded-xl p-6 hover:border-[#4A8FE8]/30 transition-colors">
              <div className="mb-4">{f.icon}</div>
              <h3 className="text-[#E8EDF4] font-semibold mb-2">{f.title}</h3>
              <p className="text-[#7A8FA8] text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-t border-[#1E2530] bg-[#13171E]">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <h2 className="text-3xl font-bold text-[#E8EDF4] mb-4 tracking-tight">Ready to start?</h2>
          <p className="text-[#7A8FA8] mb-8">Join engineers practicing RTL design on VLSI Forge.</p>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 bg-[#4A8FE8] hover:bg-[#3B7ACC] text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Create Free Account <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#1E2530] bg-[#0A0E14]">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[#7A8FA8] text-sm">
            <Cpu className="w-4 h-4" />
            <span>© 2026 VLSI Forge. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#7A8FA8]">
            <CheckCircle className="w-3.5 h-3.5 text-[#22C55E]" />
            <span>Icarus Verilog simulation engine</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
