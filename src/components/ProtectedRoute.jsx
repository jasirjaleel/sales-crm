import { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import OnboardingModal from './OnboardingModal';

const ProtectedRoute = ({ children }) => {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    // Check current session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Sync localStorage with live session
        localStorage.setItem('crm_token', session.access_token);
        
        // Always read the profile fresh, so a role change applies on the next load
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        // No profile row exists yet, create a minimal object to trigger onboarding
        const currentProfile = profile || { id: session.user.id, email: session.user.email, role: 'agent' };
        localStorage.setItem('crm_user', JSON.stringify(currentProfile));
        setUserProfile(currentProfile);
setAuthenticated(true);
      } else {
        // No valid session — clear stale localStorage
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        setAuthenticated(false);
        setUserProfile(null);
      }
      setChecking(false);
    };

    checkSession();

    // Listen for auth changes (logout, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        localStorage.removeItem('crm_token');
        localStorage.removeItem('crm_user');
        setAuthenticated(false);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        localStorage.setItem('crm_token', session.access_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen ambient-bg">
        <div className="text-[var(--accent)] font-serif text-xl animate-pulse">
          Verifying session...
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  // Intercept and enforce onboarding if the user has no name
  if (userProfile && !userProfile.name) {
    return (
      <OnboardingModal 
        user={userProfile} 
        onComplete={(updatedUser) => setUserProfile(updatedUser)} 
      />
    );
  }

  return children ? children : <Outlet />;
};

export default ProtectedRoute;
