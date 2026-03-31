import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { Cpu, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Create your account</h1>
          <p className="text-[#7A8FA8] mt-1 text-sm">Start solving RTL design problems today</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#E8EDF4] mb-1.5">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Jane Smith"
              className="w-full bg-[#1A1F28] border border-[#1E2530] rounded-lg px-3 py-2.5 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
            />
          </div>

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
                placeholder="Min 6 characters"
                className="w-full bg-[#1A1F28] border border-[#1E2530] rounded-lg px-3 py-2.5 pr-10 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A8FA8]">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm text-[#7A8FA8]">
            Already have an account?{' '}
            <Link to="/login" className="text-[#4A8FE8] hover:underline font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
