import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setBusy(true);

    const action = mode === 'signin' ? signInWithEmail : signUpWithEmail;
    const { error: authError } = await action(email, password);

    if (authError) {
      setError(authError.message);
      setBusy(false);
      return;
    }

    setBusy(false);
    router.replace('/');
  }

  return (
    <div className="app-shell">
      <div className="container auth-container">
        <div className="card auth-card">
          <div className="pill">TapDeck Account</div>
          <h1 className="title">Sign in to continue</h1>
          <p className="subtitle">
            We use your account to activate the 7-day trial on desktop.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Email</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            {error ? <div className="error-text">{error}</div> : null}

            <button className="button primary" type="submit" disabled={busy}>
              {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="auth-toggle">
            {mode === 'signin' ? (
              <button className="link-button" type="button" onClick={() => setMode('signup')}>
                New here? Create an account
              </button>
            ) : (
              <button className="link-button" type="button" onClick={() => setMode('signin')}>
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
