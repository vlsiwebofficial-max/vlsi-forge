import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import axios from 'axios';
import { Cpu, AlertCircle, CheckCircle, Mail } from 'lucide-react';

export default function VerifyEmailPage() {
  const { setUserFromToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (!email) navigate('/register');
  }, [email, navigate]);

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
    setError('');
    setLoading(true);
    try {
      const res = await axios.post(`${API}/api/auth/verify-email`, { email, code: fullCode }, { withCredentials: true });
      const { user: userData } = res.data;
      setUserFromToken(userData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResent(false);
    setError('');
    try {
      await axios.post(`${API}/api/auth/resend-verification`, { email });
      setResent(true);
      setTimeout(() => setResent(false), 5000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

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

          <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-[#2563EB]" />
          </div>
          <h1 className="text-[22px] font-extrabold text-[#111111] tracking-tight">Check your email</h1>
          <p className="text-[#888888] mt-1.5 text-sm leading-relaxed">
            We sent a 6-digit code to<br />
            <span className="font-semibold text-[#333333]">{email}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E4E4E4] rounded-2xl p-7 shadow-card">
          {error && (
            <div className="flex items-center gap-2.5 bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626] text-sm px-3.5 py-2.5 rounded-xl mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {resent && (
            <div className="flex items-center gap-2.5 bg-[#F0FDF4] border border-[#BBF7D0] text-[#16A34A] text-sm px-3.5 py-2.5 rounded-xl mb-5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              New code sent — check your inbox.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-3 text-center tracking-wide">
                Enter verification code
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#111111] hover:bg-[#2A2A2A] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-btn text-sm transition-colors"
            >
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#F0F0F0] space-y-2 text-center">
            <p className="text-sm text-[#888888]">
              Didn't receive it?{' '}
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-[#111111] font-semibold hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend code'}
              </button>
            </p>
            <p className="text-sm text-[#888888]">
              <Link to="/login" className="text-[#111111] font-semibold hover:underline">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
