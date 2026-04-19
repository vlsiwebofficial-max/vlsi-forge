import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API } from '../App';
import axios from 'axios';
import { Cpu, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Sent confirmation state ──────────────────────────────────────────────────
  if (sent) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center px-4">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.03) 0%, transparent 70%)',
        }} />

        <div className="relative w-full max-w-[360px] animate-fade-up">
          {/* Logo */}
          <div className="text-center mb-7">
            <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 bg-[#111111] rounded-[9px] flex items-center justify-center shadow-btn">
                <Cpu className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-[#111111] text-lg tracking-tight">VLSI Forge</span>
            </Link>

            <div className="w-14 h-14 rounded-2xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-[#16A34A]" />
            </div>
            <h1 className="text-[22px] font-extrabold text-[#111111] tracking-tight">Check your inbox</h1>
            <p className="text-[#888888] mt-1.5 text-sm leading-relaxed">
              If <span className="font-semibold text-[#333333]">{email}</span> is registered,
              you'll receive a reset code shortly.
            </p>
          </div>

          <div className="bg-white border border-[#E4E4E4] rounded-2xl p-7 shadow-card space-y-3">
            <button
              onClick={() => navigate('/reset-password', { state: { email } })}
              className="w-full bg-[#111111] hover:bg-[#2A2A2A] text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-btn"
            >
              Enter reset code
            </button>
            <p className="text-center text-sm text-[#888888]">
              <Link to="/login" className="text-[#111111] font-semibold hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main form ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.03) 0%, transparent 70%)',
      }} />

      <div className="relative w-full max-w-[360px] animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-7">
          <Link to="/" className="inline-flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 bg-[#111111] rounded-[9px] flex items-center justify-center shadow-btn">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#111111] text-lg tracking-tight">VLSI Forge</span>
          </Link>

          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F5] border border-[#E8E8E8] flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-[#555555]" />
          </div>
          <h1 className="text-[22px] font-extrabold text-[#111111] tracking-tight">Forgot password?</h1>
          <p className="text-[#888888] mt-1 text-sm">
            Enter your email and we'll send a reset code
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E4E4E4] rounded-2xl p-7 shadow-card">
          {error && (
            <div className="flex items-center gap-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm px-3.5 py-2.5 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-[#333333] mb-1.5">
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#CCCCCC] focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111111] hover:bg-[#2A2A2A] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm shadow-btn"
            >
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
          </form>

          <p className="text-center text-sm text-[#888888] mt-4">
            Remember your password?{' '}
            <Link to="/login" className="text-[#111111] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
