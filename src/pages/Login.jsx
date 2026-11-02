import { useState, useEffect } from 'react';
import { supabase, openedFromRecoveryLink } from '../lib/supabase';
import { brand } from '../lib/brand';
import { Eye, EyeOff } from 'lucide-react';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
const DEMO_LOGINS = [
  { label: 'Try as Owner', email: 'demo-admin@example.com' },
  { label: 'Try as Agent', email: 'demo-agent@example.com' },
];

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(openedFromRecoveryLink ? 'reset' : 'login'); // 'login' | 'forgot' | 'reset'
  const [newPassword, setNewPassword] = useState('');
const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // A recovery link signs the user in, but they still need to choose a password
    if (openedFromRecoveryLink) return;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.href = '/dashboard';
      }
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setMode('reset');
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSetNewPassword = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Please use at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Could not update your password. Please request a new link.');
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (signInError) throw signInError;

      // Fetch user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      localStorage.setItem('crm_token', data.session.access_token);
      localStorage.setItem('crm_user', JSON.stringify(profile || data.user));
      
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail) => {
    setError('');
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: import.meta.env.VITE_DEMO_PASSWORD,
      });
      if (signInError) throw signInError;
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err.message || 'The demo is unavailable right now.');
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/login` }
      );
      if (resetError) throw resetError;
      setSuccess('Password reset link sent! Check your email inbox.');
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setPassword('');
  };

  const getSubtitle = () => {
    if (mode === 'forgot') return 'We\'ll send you a reset link';
    if (mode === 'reset') return 'Choose a new password';
return 'Sign in to your agent account';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-[var(--text)] relative overflow-hidden ambient-bg">
      {/* Ambient Orbs */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>

      {/* Warm top glow */}
      <div className="warm-glow"></div>

      <div className="z-10 w-full max-w-md p-10 glass-card relative overflow-hidden">
        {/* Subtle inner glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] pointer-events-none" 
          style={{ background: 'radial-gradient(ellipse at center, rgba(16,185,129,0.04), transparent 60%)' }}
        ></div>

        <div className="text-center mb-8 relative z-10">
          <h2 className="text-3xl heading-serif mb-2">
            {brand.name}
          </h2>
          <p className="text-[var(--muted-light)] font-mono text-xs uppercase tracking-widest">{getSubtitle()}</p>
        </div>

        {DEMO_MODE && mode === 'login' && (
          <div className="relative z-10 mb-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {DEMO_LOGINS.map(d => (
                <button key={d.email} type="button" disabled={loading} onClick={() => handleDemoLogin(d.email)} className="btn-primary py-3.5 font-mono uppercase tracking-widest text-xs disabled:opacity-50">
                  {d.label}
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-[var(--muted-light)]">Invented data. No sign-up needed. Resets every night.</p>
          </div>
        )}

        {/* ── LOGIN FORM ── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-5 relative z-10">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none transition-all"
                placeholder="you@company.com"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-[var(--text)] focus:outline-none transition-all"
                  placeholder="••••••••"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-[var(--danger)]" style={{ background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.15)' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl text-sm text-[var(--success)]" style={{ background: 'rgba(0,196,140,0.08)', border: '1px solid rgba(0,196,140,0.15)' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 px-4 font-mono uppercase tracking-widest text-sm disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>

            {!DEMO_MODE && (
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-[11px] font-mono text-[var(--muted)] hover:text-[var(--accent)] transition-colors uppercase tracking-widest"
              >
                Forgot Password?
              </button>
            </div>
            )}
          </form>
        )}

        {/* ── SET NEW PASSWORD FORM ── */}
        {mode === 'reset' && (
          <form onSubmit={handleSetNewPassword} className="space-y-5 relative z-10">
            <div>
              <label htmlFor="new-password" className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">New Password</label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-[var(--danger)]" style={{ background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.15)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 px-4 font-mono uppercase tracking-widest text-sm disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save New Password'}
            </button>
          </form>
        )}

        {/* ── FORGOT PASSWORD FORM ── */}
{mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-5 relative z-10">
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-[var(--text)] focus:outline-none transition-all"
                placeholder="you@company.com"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl text-sm text-[var(--danger)]" style={{ background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.15)' }}>
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl text-sm text-[var(--success)]" style={{ background: 'rgba(0,196,140,0.08)', border: '1px solid rgba(0,196,140,0.15)' }}>
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3.5 px-4 font-mono uppercase tracking-widest text-sm disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-[11px] font-mono text-[var(--muted)] hover:text-[var(--accent)] transition-colors uppercase tracking-widest"
              >
                ← Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;
