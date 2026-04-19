import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Lock, Zap } from 'lucide-react';

/**
 * SignupModal — shown when a guest tries to submit a solution.
 * Props:
 *   onClose   — fn to dismiss the modal
 *   problemTitle — optional string shown in the headline
 */
export default function SignupModal({ onClose, problemTitle }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-[#AAAAAA] hover:text-[#333333] hover:bg-[#F5F5F5] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-[#111111] to-[#555555]" />

        {/* Content */}
        <div className="px-7 pt-7 pb-8">
          {/* Icon */}
          <div className="w-12 h-12 rounded-2xl bg-[#F5F5F5] flex items-center justify-center mb-5">
            <Lock className="w-5 h-5 text-[#111111]" />
          </div>

          <h2 className="text-[20px] font-extrabold text-[#111111] tracking-tight leading-tight mb-2">
            Create a free account to submit
          </h2>
          {problemTitle && (
            <p className="text-sm text-[#888888] mb-5 leading-relaxed">
              You need an account to run and submit your solution for <span className="font-semibold text-[#444444]">{problemTitle}</span>.
            </p>
          )}
          {!problemTitle && (
            <p className="text-sm text-[#888888] mb-5 leading-relaxed">
              Sign up for free to run your code against test cases, track your progress, and unlock all problems.
            </p>
          )}

          {/* Perks */}
          <ul className="space-y-2 mb-6">
            {[
              'Run code against hidden test cases',
              'Track solved problems & streaks',
              'Unlock Medium & Hard problems',
              'View waveforms & submission history',
            ].map((perk) => (
              <li key={perk} className="flex items-center gap-2.5 text-xs text-[#555555]">
                <Zap className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                {perk}
              </li>
            ))}
          </ul>

          {/* CTAs */}
          <Link
            to="/register"
            className="block w-full text-center bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-semibold py-2.5 rounded-xl shadow-btn mb-2.5 transition-colors"
          >
            Create free account
          </Link>
          <Link
            to="/login"
            className="block w-full text-center bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#444444] text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
