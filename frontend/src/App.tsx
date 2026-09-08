/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from '@/components/layout/Layout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Activities from './pages/Activities';
import ActivityDetail from './pages/ActivityDetail';
import Races from './pages/Races';
import AICoach from './pages/AICoach.tsx';
import AiSettings from './pages/AiSettings.tsx';
import TrainingPlan from './pages/TrainingPlan.tsx';
import PerformanceLab from './pages/PerformanceLab';
import { ThemeProvider } from '@/components/layout/ThemeProvider';

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="runos-theme">
      <BrowserRouter>
        <Toaster position="top-center" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="activities" element={<Activities />} />
              <Route path="activities/:id" element={<ActivityDetail />} />
              <Route path="races" element={<Races />} />
              <Route path="training" element={<TrainingPlan />} />
              <Route path="ai-coach" element={<AICoach />} />
              <Route path="ai-settings" element={<AiSettings />} />
              <Route path="lab" element={<PerformanceLab />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
