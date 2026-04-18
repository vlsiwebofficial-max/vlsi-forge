import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { Cpu, LayoutDashboard, BookOpen, Shield, LogOut, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLink = (to, label, icon) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium ${
        isActive(to)
          ? 'bg-[#111111] text-white shadow-btn'
          : 'text-[#666666] hover:text-[#111111] hover:bg-[#F5F5F5]'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav className="bg-white shadow-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 bg-[#111111] rounded-[7px] flex items-center justify-center shadow-btn group-hover:bg-[#333333]">
              <Cpu className="w-[15px] h-[15px] text-white" />
            </div>
            <span className="font-bold text-[#111111] text-[15px] tracking-tight">VLSI Forge</span>
            <span className="text-[9px] bg-[#F5F5F5] text-[#999999] border border-[#EBEBEB] px-1.5 py-[3px] rounded font-semibold tracking-widest uppercase">Beta</span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <div className="hidden md:flex items-center gap-0.5">
              {navLink('/dashboard', 'Dashboard', <LayoutDashboard className="w-3.5 h-3.5" />)}
              {navLink('/problems', 'Problems', <BookOpen className="w-3.5 h-3.5" />)}
              {user.role === 'admin' && navLink('/admin', 'Admin', <Shield className="w-3.5 h-3.5" />)}
            </div>
          )}

          {/* Right */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2.5 pl-2 pr-1">
                  <div className="w-7 h-7 rounded-full bg-[#111111] flex items-center justify-center shadow-sm">
                    <span className="text-[11px] font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-[#555555] font-medium">{user.name?.split(' ')[0]}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[#999999] hover:text-[#DC2626] hover:bg-[#FEF2F2]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:block">Sign out</span>
                </button>
                <button
                  className="md:hidden text-[#666666] hover:text-[#111111] p-1.5 rounded-md hover:bg-[#F5F5F5]"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm font-medium text-[#666666] hover:text-[#111111] px-3 py-1.5 rounded-md hover:bg-[#F5F5F5]">
                  Sign in
                </Link>
                <Link to="/register" className="text-sm font-semibold bg-[#111111] text-white px-4 py-1.5 rounded-md hover:bg-[#333333] shadow-btn">
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile drawer */}
        {user && menuOpen && (
          <div className="md:hidden pb-3 pt-2 border-t border-[#F0F0F0] flex flex-col gap-0.5 animate-fade-up">
            {navLink('/dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
            {navLink('/problems', 'Problems', <BookOpen className="w-4 h-4" />)}
            {user.role === 'admin' && navLink('/admin', 'Admin', <Shield className="w-4 h-4" />)}
          </div>
        )}
      </div>
    </nav>
  );
}
