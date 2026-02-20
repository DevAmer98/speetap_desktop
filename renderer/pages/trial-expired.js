import { useAuth } from '../hooks/useAuth';

export default function TrialExpiredPage() {
  const { signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="app-shell">
      <div className="container auth-container">
        <div className="card auth-card">
          <div className="pill">Trial ended</div>
          <h1 className="title">Your 7-day trial has expired</h1>
          <p className="subtitle">
            Upgrade your account to keep using TapDeck desktop and mobile.
          </p>

          <div className="auth-actions">
            <button className="button primary" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
