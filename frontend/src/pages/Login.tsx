import { useState, useEffect } from 'react';
import { Activity } from 'lucide-react';
import api from '../services/api';

export default function Login() {
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    const fetchAuthUrl = async () => {
      try {
        const response = await api.get('/auth/url');
        setAuthUrl(response.data.url);
      } catch (error) {
        console.error('Failed to fetch auth URL', error);
      }
    };
    fetchAuthUrl();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        if (event.data.token) {
          localStorage.setItem('token', event.data.token);
        }
        window.location.href = '/';
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnect = () => {
    if (!authUrl) return;
    const authWindow = window.open(authUrl, 'oauth_popup', 'width=600,height=700');
    if (!authWindow) {
      alert('Please allow popups for this site to connect your Strava account.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-16 w-16 bg-zinc-900 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shadow-sm">
            <Activity className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Welcome to RunOS
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Your AI-powered running training dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-sm sm:rounded-2xl sm:px-10 border border-zinc-200 dark:border-zinc-800 transition-colors">
          <div className="space-y-6">
            <div>
              <button
                onClick={handleConnect}
                disabled={!authUrl}
                className="flex w-full justify-center items-center rounded-xl bg-[#FC4C02] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#E34402] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FC4C02] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect with Strava
              </button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white dark:bg-zinc-900 px-2 text-zinc-500 dark:text-zinc-400">MVP Version</span>
              </div>
            </div>
            
            <div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              <p>By connecting, you allow RunOS to sync your running activities to provide training insights.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
