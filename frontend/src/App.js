import React, { createContext, useContext, useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

// ─── Route-level code splitting ───────────────────────────────────────────────
// Each page is a separate JS chunk — Monaco only loads when /problems/:id opens
const LandingPage      = lazy(() => import('./pages/LandingPage'));
const LoginPage        = lazy(() => import('./pages/LoginPage'));
const RegisterPage     = lazy(() => import('./pages/RegisterPage'));
const DashboardPage    = lazy(() => import('./pages/DashboardPage'));
const ProblemsPage     = lazy(() => import('./pages/ProblemsPage'));
const ProblemDetailPage = lazy(() => import('./pages/ProblemDetailPage'));
const SubmissionPage   = lazy(() => import('./pages/SubmissionPage'));
const AdminPage        = lazy(() => import('./pages/AdminPage'));
const VerifyEmailPage  = lazy(() => import('./pages/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));

export const API = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

// ─── Minimal page loader ──────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#E8E8E8] border-t-[#111111] animate-spin" />
        <span className="text-xs text-[#AAAAAA] font-medium tracking-wide">Loading…</span>
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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/api/auth/me`, { withCredentials: true })
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/api/auth/login`, { email, password }, { withCredentials: true });
    setUser(res.data);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
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
            <Route path="/"               element={<LandingPage />} />
            <Route path="/login"          element={<LoginPage />} />
            <Route path="/register"       element={<RegisterPage />} />
            <Route path="/verify-email"   element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password"  element={<ResetPasswordPage />} />
            <Route path="/dashboard"      element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
            <Route path="/problems"       element={<PrivateRoute><ProblemsPage /></PrivateRoute>} />
            <Route path="/problems/:id"   element={<PrivateRoute><ProblemDetailPage /></PrivateRoute>} />
            <Route path="/submissions/:id" element={<PrivateRoute><SubmissionPage /></PrivateRoute>} />
            <Route path="/admin"          element={<AdminRoute><AdminPage /></AdminRoute>} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
