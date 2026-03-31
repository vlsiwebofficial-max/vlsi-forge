import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import { Users, BookOpen, Send, Shield, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-[#13171E] border border-[#1E2530] rounded-xl p-5 flex items-center gap-4">
      <div className="p-2.5 rounded-xl bg-[#4A8FE8]/10">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-[#E8EDF4]">{value ?? '—'}</div>
        <div className="text-sm text-[#7A8FA8]">{label}</div>
      </div>
    </div>
  );
}

const statusConfig = {
  passed: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-[#22C55E]' },
  failed: { icon: <XCircle className="w-3.5 h-3.5" />, color: 'text-[#EF4444]' },
  error:  { icon: <AlertCircle className="w-3.5 h-3.5" />, color: 'text-[#F59E0B]' },
};

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${API}/api/admin/users`, { headers }),
      axios.get(`${API}/api/admin/submissions`, { headers }),
    ]).then(([usersRes, subsRes]) => {
      setUsers(usersRes.data);
      setSubmissions(subsRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const passedCount = submissions.filter(s => s.status === 'passed').length;
  const failedCount = submissions.filter(s => s.status !== 'passed').length;

  return (
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-6 h-6 text-[#4A8FE8]" />
          <div>
            <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Admin Panel</h1>
            <p className="text-[#7A8FA8] text-sm mt-0.5">Platform overview and management</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Users className="w-5 h-5 text-[#4A8FE8]" />} label="Total Users" value={loading ? '...' : users.length} />
          <StatCard icon={<Send className="w-5 h-5 text-[#A855F7]" />} label="Total Submissions" value={loading ? '...' : submissions.length} />
          <StatCard icon={<CheckCircle className="w-5 h-5 text-[#22C55E]" />} label="Accepted" value={loading ? '...' : passedCount} />
          <StatCard icon={<XCircle className="w-5 h-5 text-[#EF4444]" />} label="Rejected" value={loading ? '...' : failedCount} />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {['users', 'submissions'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-[#4A8FE8]/15 text-[#4A8FE8] border border-[#4A8FE8]/30'
                  : 'bg-[#13171E] border border-[#1E2530] text-[#7A8FA8] hover:text-[#E8EDF4]'
              }`}>
              {tab === 'users' ? <><Users className="w-4 h-4 inline mr-2" />Users ({users.length})</> : <><Send className="w-4 h-4 inline mr-2" />Submissions ({submissions.length})</>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-[#13171E] border border-[#1E2530] rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-[#4A8FE8] animate-spin" />
            </div>
          ) : activeTab === 'users' ? (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E2530] text-xs text-[#7A8FA8] font-medium">
                  <th className="px-5 py-3 text-left">Name</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left hidden sm:table-cell">Role</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2530]">
                {users.map(u => (
                  <tr key={u.user_id} className="hover:bg-[#1A1F28] transition-colors">
                    <td className="px-5 py-3.5 text-sm text-[#E8EDF4] font-medium">{u.name}</td>
                    <td className="px-5 py-3.5 text-sm text-[#7A8FA8]">{u.email}</td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        u.role === 'admin' ? 'bg-[#4A8FE8]/10 text-[#4A8FE8]' : 'bg-[#1A1F28] text-[#7A8FA8]'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#7A8FA8] hidden md:table-cell">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E2530] text-xs text-[#7A8FA8] font-medium">
                  <th className="px-5 py-3 text-left">Status</th>
                  <th className="px-5 py-3 text-left">Problem</th>
                  <th className="px-5 py-3 text-left hidden sm:table-cell">User</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Tests</th>
                  <th className="px-5 py-3 text-left hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2530]">
                {submissions.map(s => {
                  const cfg = statusConfig[s.status] || statusConfig.error;
                  return (
                    <tr key={s.submission_id} className="hover:bg-[#1A1F28] transition-colors">
                      <td className="px-5 py-3.5">
                        <span className={`flex items-center gap-1 text-sm font-medium ${cfg.color}`}>
                          {cfg.icon} {s.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-[#E8EDF4] font-mono">{s.problem_id}</td>
                      <td className="px-5 py-3.5 text-sm text-[#7A8FA8] hidden sm:table-cell">{s.user_id}</td>
                      <td className="px-5 py-3.5 text-sm text-[#7A8FA8] hidden md:table-cell">{s.passed_count}/{s.total_count}</td>
                      <td className="px-5 py-3.5 text-sm text-[#7A8FA8] hidden lg:table-cell">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
