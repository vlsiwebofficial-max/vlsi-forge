import React, { useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API } from '../App';
import axios from 'axios';
import { Cpu, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

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
      <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <Link to="/" className="inline-flex items-center gap-2 mb-6">
              <Cpu className="w-6 h-6 text-[#4A8FE8]" />
              <span className="font-bold text-[#E8EDF4] text-lg tracking-tight">VLSI Forge</span>
            </Link>
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#10B981]/10 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-[#10B981]" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Password reset!</h1>
            <p className="text-[#7A8FA8] mt-2 text-sm">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>
          <div className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6">
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Cpu className="w-6 h-6 text-[#4A8FE8]" />
            <span className="font-bold text-[#E8EDF4] text-lg tracking-tight">VLSI Forge</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Reset password</h1>
          <p className="text-[#7A8FA8] mt-1 text-sm">Enter the code from your email and a new password</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {!prefillEmail && (
            <div>
              <label className="block text-sm font-medium text-[#E8EDF4] mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full bg-[#1A1F28] border border-[#1E2530] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#E8EDF4] mb-3 text-center">6-digit reset code</label>
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
                  className="w-11 text-center text-xl font-bold bg-[#1A1F28] border border-[#1E2530] rounded-lg text-[#E8EDF4] focus:outline-none focus:border-[#4A8FE8] transition-colors"
                  style={{ height: '52px' }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EDF4] mb-1.5">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                className="w-full bg-[#1A1F28] border border-[#1E2530] rounded-lg px-3 py-2.5 pr-10 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8FA8]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Resetting...' : 'Reset password'}
          </button>

          <p className="text-center text-sm text-[#7A8FA8]">
            <Link to="/forgot-password" className="text-[#4A8FE8] hover:underline font-medium">
              Resend reset code
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
