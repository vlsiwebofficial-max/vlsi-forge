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
      if (detail === 'EMAIL_NOT_VERIFIED') {
        navigate('/verify-email', { state: { email } });
        return;
      }
      setError(detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0E14] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Cpu className="w-6 h-6 text-[#4A8FE8]" />
            <span className="font-bold text-[#E8EDF4] text-lg tracking-tight">VLSI Forge</span>
          </Link>
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Welcome back</h1>
          <p className="text-[#7A8FA8] mt-1 text-sm">Sign in to continue solving problems</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#E8EDF4] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-[#1A1F28] border border-[#1E2530] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#E8EDF4] mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-[#1A1F28] border border-[#1E2530] rounded-lg px-3 py-2.5 pr-10 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] hover:text-[#E8EDF4]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-[#4A8FE8] hover:underline">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-[#7A8FA8]">
            Don't have an account?{' '}
            <Link to="/register" className="text-[#4A8FE8] hover:underline font-medium">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
