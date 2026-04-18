import React, { createContext, useContext, useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { clearCache } from './utils/apiCache';

// ─── Route-level code splitting ───────────────────────────────────────────────
// Each page is its own JS chunk. Monaco only downloads when /problems/:id opens.
const LandingPage        = lazy(() => import('./pages/LandingPage'));
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const DashboardPage      = lazy(() => import('./pages/DashboardPage'));
const ProblemsPage       = lazy(() => import('./pages/ProblemsPage'));
const ProblemDetailPage  = lazy(() => import('./pages/ProblemDetailPage'));
const SubmissionPage     = lazy(() => import('./pages/SubmissionPage'));
const AdminPage          = lazy(() => import('./pages/AdminPage'));
const VerifyEmailPage    = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));

// ─── Exposed preload functions ────────────────────────────────────────────────
// Call these to eagerly fetch a route's JS chunk before the user navigates.
// Navbar calls them on mouseEnter so the chunk is already cached by click-time.
export const preloadDashboard     = () => import('./pages/DashboardPage');
export const preloadProblems      = () => import('./pages/ProblemsPage');
export const preloadProblemDetail = () => import('./pages/ProblemDetailPage');

export const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

// ─── Page loader spinner ──────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-7 h-7 rounded-full border-2 border-[#EFEFEF] border-t-[#111111] animate-spin" />
        <span className="text-[11px] text-[#BBBBBB] font-medium tracking-wide">Loading…</span>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  return user ? children : <Navigate to="/login" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/auth/me`, { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Proactively warm the most-visited route chunks as soon as the user is known.
  // This runs silently in the background so the first click feels instant.
  useEffect(() => {
    if (!user) return;
    // Small delay so we don't compete with the current page's render.
    const t = setTimeout(() => {
      preloadDashboard();
      preloadProblems();
      preloadProblemDetail(); // Monaco chunk starts downloading early
    }, 800);
    return () => clearTimeout(t);
  }, [user]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    setUser(res.data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    clearCache(); // wipe cached API responses so next login starts fresh
    setUser(null);
  };

  const register = async (name, email, password) => {
    const res = await axios.post(`${API}/api/auth/register`, { name, email, password });
    return res.data;
  };

  const setUserFromToken = (userData) => setUser(userData);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, setUserFromToken }}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"                element={<LandingPage />} />
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/register"        element={<RegisterPage />} />
            <Route path="/verify-email"    element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="/dashboard"       element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/problems"        element={<PrivateRoute><ProblemsPage /></PrivateRoute>} />
            <Route path="/problems/:id"    element={<PrivateRoute><ProblemDetailPage /></PrivateRoute>} />
            <Route path="/submissions/:id" element={<PrivateRoute><SubmissionPage /></PrivateRoute>} />
            <Route path="/admin"           element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
