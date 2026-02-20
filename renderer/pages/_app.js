import { useEffect } from 'react';
import { useRouter } from 'next/router';
import '../styles/theme.css';
import { useAuth } from '../hooks/useAuth';
import { useTrial } from '../hooks/useTrial';
import TitleBar from '../components/TitleBar';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { isExpired, loading: trialLoading } = useTrial(session);

  useEffect(() => {
    if (loading) return;

    const isLoginRoute = router.pathname === '/login';
    const isExpiredRoute = router.pathname === '/trial-expired';

    if (!session && !isLoginRoute) {
      router.replace('/login');
      return;
    }

    if (session && isLoginRoute) {
      router.replace('/');
      return;
    }

    if (session && isExpired && !isExpiredRoute) {
      router.replace('/trial-expired');
    }
  }, [loading, session, isExpired, router]);

  if (loading || (session && trialLoading)) {
    return (
      <>
        <TitleBar />
        <div className="app-shell">
          <div className="container">
            <div className="card auth-card">
              <div className="pill">Authenticating</div>
              <h1 className="title">Checking your access</h1>
              <p className="subtitle">Hang tight while we verify your account and trial.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TitleBar />
      <Component {...pageProps} />
    </>
  );
}
