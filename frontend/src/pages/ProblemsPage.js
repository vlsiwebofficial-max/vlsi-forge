import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API } from '../App';
import Navbar from '../components/Navbar';
import { Search, CheckCircle, Circle, ChevronRight } from 'lucide-react';

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const DIFF_COLORS = { Easy: 'text-[#22C55E] bg-[#22C55E]/10', Medium: 'text-[#F59E0B] bg-[#F59E0B]/10', Hard: 'text-[#EF4444] bg-[#EF4444]/10' };

export default function ProblemsPage() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [diff, setDiff] = useState('All');

  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get(`${API}/api/problems`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setProblems(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.tags || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDiff = diff === 'All' || p.difficulty === diff;
    return matchSearch && matchDiff;
  });

  const counts = { Easy: problems.filter(p => p.difficulty === 'Easy').length, Medium: problems.filter(p => p.difficulty === 'Medium').length, Hard: problems.filter(p => p.difficulty === 'Hard').length };

  return (
    <div className="min-h-screen bg-[#0A0E14]">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#E8EDF4] tracking-tight">Problems</h1>
          <p className="text-[#7A8FA8] text-sm mt-1">{problems.length} problems available</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
            <input
              type="text"
              placeholder="Search problems or tags..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#13171E] border border-[#1E2530] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#E8EDF4] placeholder-[#4A5568] focus:outline-none focus:border-[#4A8FE8] transition-colors"
            />
          </div>
          <div className="flex gap-2">
            {DIFFICULTIES.map(d => (
              <button
                key={d}
                onClick={() => setDiff(d)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  diff === d
                    ? 'bg-[#4A8FE8]/15 text-[#4A8FE8] border border-[#4A8FE8]/30'
                    : 'bg-[#13171E] border border-[#1E2530] text-[#7A8FA8] hover:text-[#E8EDF4]'
                }`}
              >
                {d}
                {d !== 'All' && <span className="ml-1 text-xs opacity-70">({counts[d]})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Problem List */}
        <div className="bg-[#13171E] border border-[#1E2530] rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-[#1A1F28] rounded-lg animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-[#7A8FA8] text-sm">No problems match your filters.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1E2530] text-xs text-[#7A8FA8] font-medium">
                  <th className="px-5 py-3 text-left w-8">#</th>
                  <th className="px-5 py-3 text-left">Title</th>
                  <th className="px-5 py-3 text-left hidden sm:table-cell">Difficulty</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Tags</th>
                  <th className="px-5 py-3 text-right w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2530]">
                {filtered.map((p, idx) => (
                  <tr key={p.problem_id} className="hover:bg-[#1A1F28] transition-colors group">
                    <td className="px-5 py-3.5 text-sm text-[#7A8FA8]">{idx + 1}</td>
                    <td className="px-5 py-3.5">
                      <Link to={`/problems/${p.problem_id}`} className="text-sm font-medium text-[#E8EDF4] hover:text-[#4A8FE8] transition-colors">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DIFF_COLORS[p.difficulty] || ''}`}>
                        {p.difficulty}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1.5">
                        {(p.tags || []).slice(0, 3).map(t => (
                          <span key={t} className="text-xs bg-[#1A1F28] text-[#7A8FA8] border border-[#1E2530] px-2 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <ChevronRight className="w-4 h-4 text-[#1E2530] group-hover:text-[#4A8FE8] transition-colors ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
