import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import { CheckCircle, XCircle, AlertCircle, ChevronLeft, Download, Clock, Loader2 } from 'lucide-react';

const statusConfig = {
  passed: { icon: <CheckCircle className="w-5 h-5" />, color: 'text-[#22C55E]', bg: 'bg-[#22C55E]/10 border-[#22C55E]/25', label: 'Accepted' },
  failed: { icon: <XCircle className="w-5 h-5" />, color: 'text-[#EF4444]', bg: 'bg-[#EF4444]/10 border-[#EF4444]/25', label: 'Wrong Answer' },
  error:  { icon: <AlertCircle className="w-5 h-5" />, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10 border-[#F59E0B]/25', label: 'Runtime Error' },
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
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-[#4A8FE8] animate-spin" />
      </div>
    </div>
  );

  if (!submission) return (
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="flex items-center justify-center h-64 text-[#7A8FA8]">Submission not found.</div>
    </div>
  );

  const cfg = statusConfig[submission.status] || statusConfig.error;

  return (
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#7A8FA8] hover:text-[#E8EDF4] mb-6 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Dashboard
        </Link>

        {/* Status Banner */}
        <div className={`flex items-center gap-4 p-5 rounded-xl border mb-6 ${cfg.bg}`}>
          <span className={cfg.color}>{cfg.icon}</span>
          <div>
            <div className={`text-lg font-bold ${cfg.color}`}>{cfg.label}</div>
            <div className="text-[#7A8FA8] text-sm mt-0.5">
              {submission.passed_count}/{submission.total_count} test cases passed
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-[#7A8FA8]">
            <Clock className="w-3.5 h-3.5" />
            {new Date(submission.submitted_at).toLocaleString()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Test Results */}
          <div className="bg-[#13171E] border border-[#1E2530] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#1E2530] font-semibold text-[#E8EDF4] text-sm">Test Case Results</div>
            <div className="divide-y divide-[#1E2530]">
              {(submission.testcase_results || []).map((tc, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 text-sm">
                  {tc.passed
                    ? <CheckCircle className="w-4 h-4 text-[#22C55E] shrink-0" />
                    : <XCircle className="w-4 h-4 text-[#EF4444] shrink-0" />}
                  <span className={tc.passed ? 'text-[#22C55E]' : 'text-[#EF4444]'}>Test {i + 1}</span>
                  {tc.output && (
                    <span className="ml-auto text-xs font-mono text-[#7A8FA8] truncate max-w-[200px]">
                      {tc.output.trim().slice(0, 60)}
                    </span>
                  )}
                  {tc.error && (
                    <span className="ml-auto text-xs text-[#EF4444] truncate max-w-[200px]">{tc.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-4">
            {/* Compilation Error */}
            {submission.compilation_error && (
              <div className="bg-[#13171E] border border-[#EF4444]/25 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#1E2530] font-semibold text-[#EF4444] text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Compilation Error
                </div>
                <pre className="p-4 font-mono text-xs text-[#EF4444] overflow-x-auto whitespace-pre-wrap">{submission.compilation_error}</pre>
              </div>
            )}

            {/* Actions */}
            <div className="bg-[#13171E] border border-[#1E2530] rounded-xl p-5 space-y-3">
              <Link
                to={`/problems/${submission.problem_id}`}
                className="flex items-center justify-center gap-2 w-full bg-[#4A8FE8]/10 border border-[#4A8FE8]/25 text-[#4A8FE8] hover:bg-[#4A8FE8]/20 text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Back to Problem
              </Link>
              <a
                href={`${API}/api/submissions/${id}/vcd`}
                target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-[#1A1F28] border border-[#1E2530] text-[#7A8FA8] hover:text-[#E8EDF4] text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" /> Download Waveform (VCD)
              </a>
            </div>
          </div>
        </div>

        {/* Code */}
        <div className="mt-5 bg-[#13171E] border border-[#1E2530] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#1E2530] font-semibold text-[#E8EDF4] text-sm">Submitted Code</div>
          <pre className="p-5 font-mono text-xs text-[#C8D4E0] overflow-x-auto leading-relaxed">{submission.code}</pre>
        </div>
      </div>
    </div>
  );
}
