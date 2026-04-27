/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { NotificationManager } from './components/NotificationManager';
import { NotificationProvider } from './hooks/useNotifications';

const Landing = lazy(() => import('./pages/Landing'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CrisisMap = lazy(() => import('./pages/CrisisMap'));
const Resources = lazy(() => import('./pages/Resources'));
const SOSApp = lazy(() => import('./pages/SOSApp'));
const Analytics = lazy(() => import('./pages/Analytics'));
const SupplyChain = lazy(() => import('./pages/SupplyChain'));
const AIAssistant = lazy(() => import('./pages/AIAssistant'));
const GlobalCrisisDashboard = lazy(() => import('./pages/GlobalCrisisDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const OperationsCopilot = lazy(() => import('./components/assistant/OperationsCopilot'));

function RouteLoader() {
  return <div className="min-h-screen bg-black" />;
}

export default function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <main className="min-h-screen bg-black text-white">
          <NotificationManager />
          <Suspense fallback={null}>
            <OperationsCopilot />
          </Suspense>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/landing" element={<Landing />} />

              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/global-crisis" element={<ProtectedRoute><GlobalCrisisDashboard /></ProtectedRoute>} />
              <Route path="/crisis-map" element={<CrisisMap />} />
              <Route path="/resources" element={<ProtectedRoute allowedRoles={['admin', 'rescue_team']}><Resources /></ProtectedRoute>} />
              <Route path="/sos-citizen" element={<ProtectedRoute><SOSApp /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'rescue_team']}><Analytics /></ProtectedRoute>} />
              <Route path="/supply-chain" element={<ProtectedRoute allowedRoles={['admin', 'rescue_team']}><SupplyChain /></ProtectedRoute>} />
              <Route path="/ai-assistant" element={<ProtectedRoute allowedRoles={['admin', 'rescue_team']}><AIAssistant /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

              <Route path="/map" element={<Navigate to="/crisis-map" replace />} />
              <Route path="/sos" element={<Navigate to="/sos-citizen" replace />} />
              <Route path="/supply" element={<Navigate to="/supply-chain" replace />} />
              <Route path="/assistant" element={<Navigate to="/ai-assistant" replace />} />
              <Route path="/global" element={<Navigate to="/global-crisis" replace />} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </NotificationProvider>
    </BrowserRouter>
  );
}
