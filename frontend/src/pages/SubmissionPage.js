import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, AlertCircle, ChevronLeft, Download, Clock, Loader2 } from 'lucide-react';

const statusConfig = {
  passed: {
    icon: <CheckCircle className="w-5 h-5" />,
    color: 'text-[#16A34A]',
    bg: 'bg-[#F0FDF4] border-[#BBF7D0]',
    label: 'Accepted',
  },
  failed: {
    icon: <XCircle className="w-5 h-5" />,
    color: 'text-[#DC2626]',
    bg: 'bg-[#FEF2F2] border-[#FECACA]',
    label: 'Wrong Answer',
  },
  error: {
    icon: <AlertCircle className="w-5 h-5" />,
    color: 'text-[#D97706]',
    bg: 'bg-[#FFFBEB] border-[#FDE68A]',
    label: 'Runtime Error',
  },
};

export default function SubmissionPage() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/submissions/${id}`, { withCredentials: true })
      .then(res => setSubmission(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#111111] animate-spin" />
      </div>
    </div>
  );

  if (!submission) return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="flex items-center justify-center h-64 text-[#888888] text-sm">Submission not found.</div>
    </div>
  );

  const cfg = statusConfig[submission.status] || statusConfig.error;

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Back */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-[#888888] hover:text-[#111111] mb-6 transition-colors font-medium"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Status Banner */}
        <div className={`flex items-center gap-4 p-5 rounded-2xl border mb-6 ${cfg.bg}`}>
          <span className={cfg.color}>{cfg.icon}</span>
          <div>
            <div className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</div>
            <div className="text-[#666666] text-sm mt-0.5">
              {submission.passed_count}/{submission.total_count} test cases passed
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-[#AAAAAA]">
            <Clock className="w-3.5 h-3.5" />
            {new Date(submission.submitted_at).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Test Results */}
          <div className="bg-white border border-[#E4E4E4] rounded-2xl overflow-hidden shadow-card">
            <div className="px-5 py-3.5 border-b border-[#F0F0F0] font-semibold text-[#111111] text-sm">
              Test Case Results
            </div>
            <div className="divide-y divide-[#F5F5F5]">
              {(submission.testcase_results || []).map((tc, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {tc.passed
                    ? <CheckCircle className="w-4 h-4 text-[#16A34A] shrink-0" />
                    : <XCircle className="w-4 h-4 text-[#DC2626] shrink-0" />}
                  <span className={tc.passed ? 'text-[#16A34A] font-medium' : 'text-[#DC2626] font-medium'}>
                    Test {i + 1}
                  </span>
                  {tc.output && (
                    <span className="ml-auto text-xs font-mono text-[#888888] truncate max-w-[200px]">
                      {tc.output.trim().slice(0, 60)}
                    </span>
                  )}
                  {tc.error && (
                    <span className="ml-auto text-xs text-[#DC2626] truncate max-w-[200px]">{tc.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            {/* Compilation Error */}
            {submission.compilation_error && (
              <div className="bg-white border border-[#FECACA] rounded-2xl overflow-hidden shadow-card">
                <div className="px-5 py-3.5 border-b border-[#FEE2E2] font-semibold text-[#DC2626] text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Compilation Error
                </div>
                <pre className="p-4 font-mono text-xs text-[#DC2626] bg-[#FEF2F2] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {submission.compilation_error}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="bg-white border border-[#E4E4E4] rounded-2xl p-5 space-y-3 shadow-card">
              <Link
                to={`/problems/${submission.problem_id}`}
                className="flex items-center justify-center gap-2 w-full bg-[#111111] hover:bg-[#2A2A2A] text-white text-sm font-semibold py-2.5 rounded-xl shadow-btn transition-colors"
              >
                Back to Problem
              </Link>
              <a
                href={`${API}/api/submissions/${id}/vcd`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#FAFAFA] border border-[#E4E4E4] text-[#555555] hover:text-[#111111] hover:border-[#BBBBBB] text-sm font-medium py-2.5 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" /> Download Waveform (VCD)
              </a>
            </div>
          </div>
        </div>

        {/* Submitted Code */}
        <div className="mt-5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden shadow-card">
          <div className="px-5 py-3.5 border-b border-[#2A2A2A] font-semibold text-[#CCCCCC] text-sm flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            </div>
            <span className="ml-1">Submitted Code</span>
          </div>
          <pre className="p-5 font-mono text-xs text-[#C8D4E0] overflow-x-auto leading-relaxed">{submission.code}</pre>
        </div>
      </div>
    </div>
  );
}
