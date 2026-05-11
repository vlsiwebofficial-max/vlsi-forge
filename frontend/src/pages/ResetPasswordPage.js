import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API } from '../App';
import axios from 'axios';
import { Cpu, Eye, EyeOff, AlertCircle, CheckCircle, KeyRound } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = location.state?.email || '';

  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRefs = useRef([]);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    pasted.split('').forEach((ch, i) => { newCode[i] = ch; });
    setCode(newCode);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fullCode = code.join('');
    if (fullCode.length < 6) { setError('Please enter the 6-digit code'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await axios.post(`${API}/api/auth/reset-password`, {
        email,
        code: fullCode,
        new_password: password
      });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center px-4">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.03) 0%, transparent 70%)',
        }} />
        <div className="relative w-full max-w-[360px] animate-fade-up">
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
            <h1 className="text-[22px] font-extrabold text-[#111111] tracking-tight">Password updated!</h1>
            <p className="text-[#888888] mt-1.5 text-sm">You can now sign in with your new password.</p>
          </div>
          <div className="bg-white border border-[#E4E4E4] rounded-2xl p-7 shadow-card">
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-[#111111] hover:bg-[#2A2A2A] text-white font-semibold py-2.5 rounded-xl shadow-btn text-sm transition-colors"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,0,0,0.03) 0%, transparent 70%)',
      }} />

      <div className="relative w-full max-w-[380px] animate-fade-up">
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
          <h1 className="text-[22px] font-extrabold text-[#111111] tracking-tight">Reset password</h1>
          <p className="text-[#888888] mt-1 text-sm">Enter the code from your email and choose a new password</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E4E4E4] rounded-2xl p-7 shadow-card">
          {error && (
            <div className="flex items-center gap-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm px-3.5 py-2.5 rounded-xl mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!prefillEmail && (
              <div>
                <label className="block text-xs font-semibold text-[#333333] mb-1.5 tracking-wide">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#C8C8C8] focus:outline-none focus:bg-white focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-3 text-center tracking-wide">
                6-digit reset code
              </label>
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={el => inputRefs.current[i] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    className="w-11 h-12 text-center text-xl font-bold bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl text-[#111111] focus:outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1.5 tracking-wide">New password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Min 6 characters"
                  className="w-full bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#111111] placeholder-[#C8C8C8] focus:outline-none focus:bg-white focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BBBBBB] hover:text-[#555555]"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111111] hover:bg-[#2A2A2A] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-btn text-sm mt-1 transition-colors"
            >
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p className="text-center text-sm text-[#888888] mt-5">
            Need a new code?{' '}
            <Link to="/forgot-password" className="text-[#111111] font-semibold hover:underline">
              Resend
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
