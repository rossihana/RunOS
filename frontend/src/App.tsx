/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

// Lazy-load: setiap halaman jadi chunk sendiri — Recharts/Leaflet hanya
// dimuat saat halaman yang memakainya dibuka (LCP chunk awal turun).
const Login = lazy(() => import('./pages/Login'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Activities = lazy(() => import('./pages/Activities'));
const ActivityDetail = lazy(() => import('./pages/ActivityDetail'));
const Races = lazy(() => import('./pages/Races'));
const AICoach = lazy(() => import('./pages/AICoach.tsx'));
const AiSettings = lazy(() => import('./pages/AiSettings.tsx'));
const GarminSettings = lazy(() => import('./pages/GarminSettings.tsx'));
const TrainingPlan = lazy(() => import('./pages/TrainingPlan.tsx'));
const PerformanceLab = lazy(() => import('./pages/PerformanceLab'));

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center text-sm text-zinc-400">
    Memuat…
  </div>
);

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="runos-theme">
      <BrowserRouter>
        <Toaster position="top-center" />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="activities" element={<Activities />} />
                <Route path="activities/:id" element={<ActivityDetail />} />
                <Route path="races" element={<Races />} />
                <Route path="training" element={<TrainingPlan />} />
                <Route path="ai-coach" element={<AICoach />} />
                <Route path="ai-settings" element={<AiSettings />} />
                <Route path="garmin" element={<GarminSettings />} />
                <Route path="lab" element={<PerformanceLab />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}
