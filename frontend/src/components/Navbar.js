import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, preloadDashboard, preloadProblems } from '../App';
import { Cpu, LayoutDashboard, BookOpen, Shield, LogOut, ChevronDown, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); setProfileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  // Map routes to their preload functions so hovering a link prefetches its chunk
  const PRELOADERS = {
    '/dashboard': preloadDashboard,
    '/problems':  preloadProblems,
  };

  // Underline-style nav link (right side) — prefetches chunk on hover
  const NavLink = ({ to, label }) => (
    <Link
      to={to}
      onMouseEnter={() => PRELOADERS[to]?.()}
      className={`relative text-sm font-medium py-1 group transition-colors ${
        isActive(to) ? 'text-[#111111]' : 'text-[#888888] hover:text-[#444444]'
      }`}
    >
      {label}
      <span
        className={`absolute -bottom-px left-0 right-0 h-[2px] rounded-full bg-[#111111] transition-transform duration-200 origin-left ${
          isActive(to) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
        }`}
      />
    </Link>
  );

  return (
    <nav className="navbar-glass sticky top-0 z-50">
      <div className="max-w-screen-xl mx-auto px-5 sm:px-8">
        {/* ── 3-column grid: Brand | Product | Nav ── */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center h-[58px]">

          {/* ── Col 1: VLSI parent brand (left) ── */}
          <div className="flex items-center gap-3">
            <a
              href="https://vlsiweb.com"
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 shrink-0"
              title="VLSI WEB — main site"
            >
              <div className="w-7 h-7 bg-[#111111] rounded-[7px] flex items-center justify-center shadow-btn group-hover:bg-[#2A2A2A] transition-colors">
                <Cpu className="w-[15px] h-[15px] text-white" />
              </div>
              <span className="hidden sm:block font-bold text-[#111111] text-[15px] tracking-tight group-hover:text-[#444444] transition-colors">
                VLSI WEB
              </span>
            </a>

            {/* Separator slash */}
            <span className="hidden sm:block text-[#DDDDDD] text-xl font-light select-none">/</span>
          </div>

          {/* ── Col 2: VLSI Forge product name (true center) ── */}
          <Link
            to={user ? '/dashboard' : '/'}
            className="flex items-center gap-2 group"
          >
            <span className="font-extrabold text-[#111111] text-[15px] tracking-tight group-hover:text-[#333333] transition-colors">
              VLSI Forge
            </span>
            <span className="text-[8px] bg-[#111111] text-white px-1.5 py-[3px] rounded font-black tracking-[0.12em] uppercase leading-none">
              Beta
            </span>
          </Link>

          {/* ── Col 3: Nav links + avatar (right) ── */}
          <div className="flex items-center justify-end">
            {user ? (
              <>
                {/* Desktop nav links */}
                <div className="hidden md:flex items-center gap-6 mr-4">
                  <NavLink to="/dashboard" label="Dashboard" />
                  <NavLink to="/problems" label="Problems" />
                  {user.role === 'admin' && <NavLink to="/admin" label="Admin" />}
                </div>

                {/* Vertical divider */}
                <div className="hidden md:block h-4 w-px bg-[#E8E8E8] mr-4" />

                {/* Avatar dropdown */}
                <div className="hidden md:block relative" ref={profileRef}>
                  <button
                    onClick={() => setProfileOpen(o => !o)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-[#F5F5F5] transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#111111] flex items-center justify-center shadow-sm shrink-0">
                      <span className="text-[11px] font-bold text-white">
                        {user.name?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm text-[#333333] font-medium max-w-[80px] truncate">
                      {user.name?.split(' ')[0]}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-[#AAAAAA] transition-transform duration-200 ${
                        profileOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Dropdown panel */}
                  {profileOpen && (
                    <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl border border-[#E8E8E8] shadow-dropdown z-50 overflow-hidden animate-scale-in">
                      {/* User info header */}
                      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F0F0F0]">
                        <div className="w-9 h-9 rounded-full bg-[#111111] flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-white">
                            {user.name?.[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-[#111111] text-sm truncate">
                            {user.name}
                          </div>
                          <div className="text-xs text-[#888888] truncate mt-0.5">
                            {user.email}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-1.5">
                        <Link
                          to="/dashboard"
                          onMouseEnter={preloadDashboard}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#444444] hover:bg-[#F5F5F5] transition-colors font-medium"
                        >
                          <LayoutDashboard className="w-4 h-4 text-[#888888]" />
                          Dashboard
                        </Link>
                        <Link
                          to="/problems"
                          onMouseEnter={preloadProblems}
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#444444] hover:bg-[#F5F5F5] transition-colors font-medium"
                        >
                          <BookOpen className="w-4 h-4 text-[#888888]" />
                          Problems
                        </Link>
                        {user.role === 'admin' && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#444444] hover:bg-[#F5F5F5] transition-colors font-medium"
                          >
                            <Shield className="w-4 h-4 text-[#888888]" />
                            Admin
                          </Link>
                        )}
                      </div>

                      {/* Sign out */}
                      <div className="p-1.5 pt-0 border-t border-[#F5F5F5]">
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-[#DC2626] hover:bg-[#FEF2F2] transition-colors font-medium mt-1"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mobile hamburger */}
                <button
                  className="md:hidden text-[#666666] hover:text-[#111111] p-1.5 rounded-md hover:bg-[#F5F5F5]"
                  onClick={() => setMenuOpen(o => !o)}
                  aria-label="Toggle menu"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="text-sm font-medium text-[#666666] hover:text-[#111111] px-3 py-1.5 rounded-lg hover:bg-[#F5F5F5]"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-semibold bg-[#111111] text-white px-4 py-1.5 rounded-lg hover:bg-[#2A2A2A] shadow-btn"
                >
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── Mobile drawer ── */}
        {user && menuOpen && (
          <div className="md:hidden pb-3 pt-2 border-t border-[#F0F0F0] space-y-0.5 animate-fade-up">
            {/* User info */}
            <div className="flex items-center gap-3 px-3 py-2.5 mb-1">
              <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center">
                <span className="text-xs font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-[#111111]">{user.name}</div>
                <div className="text-xs text-[#888888] truncate">{user.email}</div>
              </div>
            </div>

            <Link to="/dashboard" className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${isActive('/dashboard') ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </Link>
            <Link to="/problems" className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${isActive('/problems') ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'}`}>
              <BookOpen className="w-4 h-4" /> Problems
            </Link>
            {user.role === 'admin' && (
              <Link to="/admin" className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium ${isActive('/admin') ? 'bg-[#111111] text-white' : 'text-[#555555] hover:bg-[#F5F5F5]'}`}>
                <Shield className="w-4 h-4" /> Admin
              </Link>
            )}

            <div className="pt-1.5 mt-1.5 border-t border-[#F0F0F0]">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-[#DC2626] hover:bg-[#FEF2F2]"
              >
                <LogOut className="w-4 h-4" /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
