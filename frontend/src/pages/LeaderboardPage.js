import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth, API } from '../App';
import Navbar from '../components/Navbar';
import { Trophy, Medal } from 'lucide-react';

const RANK_STYLE = {
  1: { bg: 'bg-[#FFFBEB]', border: 'border-[#FDE68A]', text: 'text-[#D97706]', badge: '🥇' },
  2: { bg: 'bg-[#F8FAFC]', border: 'border-[#E2E8F0]', text: 'text-[#64748B]', badge: '🥈' },
  3: { bg: 'bg-[#FFF7ED]', border: 'border-[#FDBA74]', text: 'text-[#EA580C]', badge: '🥉' },
};

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/leaderboard`, { withCredentials: true })
      .then(r => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myRank = rows.find(r => r.user_id === user?.user_id);

  return (
    <div className="min-h-screen bg-[#F8F8F8]">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <p className="text-[10px] font-bold tracking-[0.16em] text-[#BBBBBB] uppercase mb-1.5">Rankings</p>
          <h1 className="text-[26px] font-extrabold text-[#111111] tracking-tight flex items-center gap-3">
            <Trophy className="w-7 h-7 text-[#D97706]"/> Leaderboard
          </h1>
          <p className="text-sm text-[#888888] mt-1">Top solvers ranked by unique problems solved</p>
        </div>

        {/* Your rank banner */}
        {!loading && myRank && (
          <div className="mb-6 bg-[#111111] text-white rounded-2xl px-6 py-4 flex items-center justify-between shadow-btn animate-fade-up">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center font-black text-sm">
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-bold text-sm">Your ranking</div>
                <div className="text-white/60 text-xs">Keep solving to climb higher</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black">#{myRank.rank}</div>
              <div className="text-white/60 text-xs">{myRank.problems_solved} solved</div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden shadow-card animate-fade-up">
          {/* Header */}
          <div className="grid grid-cols-12 px-6 py-3 bg-[#FAFAFA] border-b border-[#F0F0F0]">
            <div className="col-span-1 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">#</div>
            <div className="col-span-7 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase">Name</div>
            <div className="col-span-4 text-[9px] font-bold tracking-[0.14em] text-[#BBBBBB] uppercase text-right">Solved</div>
          </div>

          {loading ? (
            <div className="p-5 space-y-2.5">
              {[...Array(10)].map((_,i) => (
                <div key={i} className="h-14 rounded-xl shimmer" style={{ opacity: 1 - i * 0.08 }}/>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center">
              <Trophy className="w-10 h-10 text-[#EEEEEE] mx-auto mb-3"/>
              <p className="text-[#888888] text-sm">No submissions yet — be the first!</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F5F5F5]">
              {rows.map((row) => {
                const isMe = row.user_id === user?.user_id;
                const rs   = RANK_STYLE[row.rank] || {};
                const initials = (row.name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                return (
                  <div
                    key={row.user_id}
                    className={`grid grid-cols-12 items-center px-6 py-3.5 transition-colors ${
                      isMe ? 'bg-[#F8F8FF]' : 'hover:bg-[#FAFAFA]'
                    } ${row.rank <= 3 ? `${rs.bg}` : ''}`}
                  >
                    {/* Rank */}
                    <div className="col-span-1">
                      {row.rank <= 3 ? (
                        <span className="text-lg">{rs.badge}</span>
                      ) : (
                        <span className="text-sm font-bold text-[#AAAAAA] font-mono tabular-nums">
                          {String(row.rank).padStart(2, '0')}
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div className="col-span-7 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        isMe ? 'bg-[#111111] text-white' : 'bg-[#F0F0F0] text-[#555555]'
                      }`}>
                        {initials}
                      </div>
                      <div>
                        <div className={`text-sm font-semibold ${isMe ? 'text-[#111111]' : 'text-[#333333]'}`}>
                          {row.display_name || row.name || 'Anonymous'}
                          {isMe && <span className="ml-2 text-[10px] font-bold text-[#888888] bg-[#F0F0F0] px-1.5 py-0.5 rounded">You</span>}
                        </div>
                      </div>
                    </div>

                    {/* Solved count */}
                    <div className="col-span-4 text-right">
                      <span className={`text-lg font-extrabold ${row.rank <= 3 ? rs.text : 'text-[#111111]'}`}>
                        {row.problems_solved}
                      </span>
                      <span className="text-xs text-[#AAAAAA] ml-1">solved</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-[#CCCCCC] mt-6 flex items-center justify-center gap-1.5">
          <Medal className="w-3.5 h-3.5"/> Rankings update in real time as problems are solved
        </p>
      </div>
    </div>
  );
}
