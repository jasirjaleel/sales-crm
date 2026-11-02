import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, CheckCircle } from 'lucide-react';

export default function OnboardingModal({ user, onComplete }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          email: user.email,
          name: name.trim()
        });

      if (updateError) throw updateError;

      // Update local storage
      const updatedUser = { ...user, name: name.trim() };
      localStorage.setItem('crm_user', JSON.stringify(updatedUser));
      
      onComplete(updatedUser);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center ambient-bg animate-in fade-in duration-300">
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="warm-glow"></div>

      <div className="relative glass-card w-full max-w-md p-10 flex flex-col shadow-2xl z-10 overflow-hidden" 
           style={{ border: '1px solid rgba(200, 180, 138, 0.2)' }}>
        
        {/* Subtle inner glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[150px] pointer-events-none" 
          style={{ background: 'radial-gradient(ellipse at center, rgba(200,180,138,0.06), transparent 60%)' }}
        ></div>

        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center avatar-gold"
               style={{ border: '1px solid rgba(200,180,138,0.2)' }}>
            <User className="w-8 h-8 text-[var(--accent)]" />
          </div>
          <h2 className="text-3xl font-serif text-[var(--text)] mb-2 tracking-tight">Welcome Aboard</h2>
          <p className="text-[var(--muted-light)] font-mono text-xs uppercase tracking-widest leading-relaxed">
            Let's get your profile set up before you access the CRM.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">Full Name</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-3.5 rounded-xl text-[var(--text)] focus:outline-none font-sans placeholder-[var(--muted)] transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl text-sm font-sans flex items-center gap-3 text-[var(--danger)]" style={{ background: 'rgba(255,90,90,0.08)', border: '1px solid rgba(255,90,90,0.15)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="btn-primary w-full py-4 text-sm font-mono uppercase tracking-[0.15em] flex items-center justify-center gap-3 disabled:opacity-50 mt-4"
          >
            {loading ? 'Saving Profile...' : (
              <>
                <CheckCircle className="w-4 h-4" /> Complete Setup
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
