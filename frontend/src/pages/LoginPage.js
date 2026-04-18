import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Cpu, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === 'EMAIL_NOT_VERIFIED') { navigate('/verify-email', { state: { email } }); return; }
      setError(detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] flex flex-col items-center justify-center px-4">
      {/* Subtle background gradient */}
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
          <h1 className="text-[22px] font-extrabold text-[#111111] tracking-tight">Welcome back</h1>
          <p className="text-[#888888] mt-1 text-sm">Sign in to continue solving</p>
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
              <label className="block text-xs font-semibold text-[#333333] mb-1.5 tracking-wide">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                className="w-full bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl px-3.5 py-2.5 text-sm text-[#111111] placeholder-[#C8C8C8] focus:outline-none focus:bg-white focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#333333] mb-1.5 tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder="••••••••"
                  className="w-full bg-[#FAFAFA] border border-[#E4E4E4] rounded-xl px-3.5 py-2.5 pr-10 text-sm text-[#111111] placeholder-[#C8C8C8] focus:outline-none focus:bg-white focus:border-[#111111] focus:ring-2 focus:ring-[#111111]/10 transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#BBBBBB] hover:text-[#555555]">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-[#888888] hover:text-[#111111] font-medium">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-[#111111] hover:bg-[#2A2A2A] disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl shadow-btn text-sm mt-1">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-[#F0F0F0] text-center">
            <p className="text-sm text-[#888888]">
              No account?{' '}
              <Link to="/register" className="text-[#111111] font-semibold hover:underline">Create one free</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
