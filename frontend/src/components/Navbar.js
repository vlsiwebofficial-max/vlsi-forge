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
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive(to)
          ? 'bg-[#4A8FE8]/15 text-[#4A8FE8]'
          : 'text-[#7A8FA8] hover:text-[#E8EDF4] hover:bg-[#1A1F28]'
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <nav className="bg-[#13171E] border-b border-[#1E2530] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to={user ? '/dashboard' : '/'} className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-[#4A8FE8]" />
            <span className="font-bold text-[#E8EDF4] text-base tracking-tight">VLSI Forge</span>
            <span className="text-xs bg-[#4A8FE8]/15 text-[#4A8FE8] border border-[#4A8FE8]/30 px-2 py-0.5 rounded-full font-semibold">BETA</span>
          </Link>

          {/* Desktop nav */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {navLink('/dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
              {navLink('/problems', 'Problems', <BookOpen className="w-4 h-4" />)}
              {user.role === 'admin' && navLink('/admin', 'Admin', <Shield className="w-4 h-4" />)}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden md:block text-sm text-[#7A8FA8]">{user.name}</span>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-[#7A8FA8] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden md:block">Logout</span>
                </button>
                {/* Mobile menu toggle */}
                <button
                  className="md:hidden text-[#7A8FA8]"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-sm font-medium text-[#7A8FA8] hover:text-[#E8EDF4] px-3 py-1.5 rounded-lg transition-colors">
                  Sign in
                </Link>
                <Link to="/register" className="text-sm font-medium bg-[#4A8FE8] text-white px-4 py-1.5 rounded-lg hover:bg-[#3B7ACC] transition-colors">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {user && menuOpen && (
          <div className="md:hidden pb-3 pt-1 border-t border-[#1E2530] flex flex-col gap-1">
            {navLink('/dashboard', 'Dashboard', <LayoutDashboard className="w-4 h-4" />)}
            {navLink('/problems', 'Problems', <BookOpen className="w-4 h-4" />)}
            {user.role === 'admin' && navLink('/admin', 'Admin', <Shield className="w-4 h-4" />)}
          </div>
        )}
      </div>
    </nav>
  );
}
