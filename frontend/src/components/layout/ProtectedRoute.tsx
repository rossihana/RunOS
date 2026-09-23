import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import api from '../../services/api';

export default function ProtectedRoute() {
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>(
    token ? 'loading' : 'unauthenticated'
  );

  useEffect(() => {
    const verifyAuth = () => {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        setStatus('unauthenticated');
        return;
      }

      api.get('/auth/me')
        .then(() => setStatus('authenticated'))
        .catch(() => {
          localStorage.removeItem('token');
          setStatus('unauthenticated');
        });
    };

    verifyAuth();

    // Mencegah akses via bfcache (Back/Forward browser mouse/button) setelah logout
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted || !localStorage.getItem('token')) {
        if (!localStorage.getItem('token')) {
          setStatus('unauthenticated');
          window.location.replace('/login');
          return;
        }
        verifyAuth();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [location.pathname]);

  // Pengecekan sinkron: jika token sudah tidak ada di localStorage, tolak seketika
  if (!token || status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
