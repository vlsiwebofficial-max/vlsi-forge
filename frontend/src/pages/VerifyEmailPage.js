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
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Cpu className="w-6 h-6 text-[#4A8FE8]" />
            <span className="font-bold text-[#E8EDF4] text-lg tracking-tight">VLSI Forge</span>
          </Link>
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#4A8FE8]/10 flex items-center justify-center">
              <Mail className="w-7 h-7 text-[#4A8FE8]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Check your email</h1>
          <p className="text-[#7A8FA8] mt-1 text-sm">
            We sent a 6-digit code to<br />
            <span className="text-[#E8EDF4] font-medium">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {resent && (
            <div className="flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] text-sm px-3 py-2.5 rounded-lg">
              <CheckCircle className="w-4 h-4 shrink-0" />
              New code sent! Check your inbox.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#E8EDF4] mb-3 text-center">
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
                  className="w-11 h-13 text-center text-xl font-bold bg-[#1A1F28] border border-[#1E2530] rounded-lg text-[#E8EDF4] focus:outline-none focus:border-[#4A8FE8] transition-colors"
                  style={{ height: '52px' }}
                />
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Verifying...' : 'Verify email'}
          </button>

          <p className="text-center text-sm text-[#7A8FA8]">
            Didn't receive it?{' '}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-[#4A8FE8] hover:underline font-medium disabled:opacity-60"
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          </p>

          <p className="text-center text-sm text-[#7A8FA8]">
            <Link to="/login" className="text-[#4A8FE8] hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
