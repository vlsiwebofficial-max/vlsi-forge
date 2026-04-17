import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { Cpu, LayoutDashboard, BookOpen, Shield, LogOut, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLink = (to, label, icon) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        isActive(to)
          ? 'bg-[#111111] text-white'
          : 'text-[#555555] hover:text-[#111111] hover:bg-[#F5F5F5]'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav className="bg-white border-b border-[#E8E8E8] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#111111] rounded-md flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-[#111111] text-[15px] tracking-tight">VLSI Forge</span>
            <span className="text-[10px] bg-[#F5F5F5] text-[#888888] border border-[#E8E8E8] px-1.5 py-0.5 rounded font-semibold tracking-wide">BETA</span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <div className="hidden md:flex items-center gap-0.5">
              {navLink('/dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
              {navLink('/problems', 'Problems', <BookOpen className="w-4 h-4" />)}
              {user.role === 'admin' && navLink('/admin', 'Admin', <Shield className="w-4 h-4" />)}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-2 mr-1">
                  <div className="w-7 h-7 rounded-full bg-[#111111] flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{user.name?.[0]?.toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-[#555555] font-medium">{user.name?.split(' ')[0]}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-[#888888] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:block">Sign out</span>
                </button>
                <button
                  className="md:hidden text-[#555555] hover:text-[#111111] p-1.5 rounded-md hover:bg-[#F5F5F5] transition-colors"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm font-medium text-[#555555] hover:text-[#111111] px-3 py-1.5 rounded-md hover:bg-[#F5F5F5] transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="text-sm font-medium bg-[#111111] text-white px-4 py-1.5 rounded-md hover:bg-[#333333] transition-colors">
                  Get started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {user && menuOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-[#E8E8E8] flex flex-col gap-0.5">
            {navLink('/dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
            {navLink('/problems', 'Problems', <BookOpen className="w-4 h-4" />)}
            {user.role === 'admin' && navLink('/admin', 'Admin', <Shield className="w-4 h-4" />)}
          </div>
        )}
      </div>
    </nav>
  );
}
