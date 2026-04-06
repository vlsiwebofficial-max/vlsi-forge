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

  if (sent) {
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
            <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Code sent!</h1>
            <p className="text-[#7A8FA8] mt-2 text-sm">
              If <span className="text-[#E8EDF4] font-medium">{email}</span> is registered,
              you'll receive a reset code shortly.
            </p>
          </div>

          <div className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6 space-y-4">
            <button
              onClick={() => navigate('/reset-password', { state: { email } })}
              className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Enter reset code
            </button>
            <p className="text-center text-sm text-[#7A8FA8]">
              <Link to="/login" className="text-[#4A8FE8] hover:underline font-medium">
                Back to sign in
              </Link>
            </p>
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
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-[#4A8FE8]/10 flex items-center justify-center">
              <KeyRound className="w-7 h-7 text-[#4A8FE8]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Forgot password?</h1>
          <p className="text-[#7A8FA8] mt-1 text-sm">
            Enter your email and we'll send a reset code
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#13171E] border border-[#1E2530] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-sm px-3 py-2.5 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

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

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#4A8FE8] hover:bg-[#3B7ACC] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            {loading ? 'Sending...' : 'Send reset code'}
          </button>

          <p className="text-center text-sm text-[#7A8FA8]">
            Remember your password?{' '}
            <Link to="/login" className="text-[#4A8FE8] hover:underline font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
