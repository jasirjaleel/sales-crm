import { useState } from 'react';
import { Bell, Search, Settings, ChevronDown, Check, LogOut, User, Shield } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function TopBar() {
  const location = useLocation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const viewMode = user?.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_admin_token');
    localStorage.removeItem('crm_view_mode');
    window.location.href = '/login';
  };

  const setViewMode = (mode) => {
    localStorage.setItem('crm_view_mode', mode);
    window.location.reload();
  };

  // Format page title from pathname
  const getPageTitle = () => {
    const path = location.pathname.substring(1);
    if (!path) return 'Dashboard';
    
    const parts = path.split('/').map(word => word.charAt(0).toUpperCase() + word.slice(1).replace('-', ' '));
    return parts.join(' / ');
  };

  return (
    <header 
      className="h-14 md:h-16 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 bg-[var(--bg-root)] border-b border-[var(--border-subtle)]"
    >
      <h2 className="text-lg font-medium text-[var(--text-primary)] tracking-tight truncate">{getPageTitle()}</h2>
      
      <div className="flex items-center gap-4 md:gap-6">
        {/* Search — desktop only */}
        <div className="relative hidden md:block">
          <Search strokeWidth={1.5} className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="pl-10 pr-4 py-1.5 rounded-lg text-sm text-[var(--text-primary)] focus:outline-none w-64 placeholder-[var(--text-tertiary)] transition-colors bg-[var(--bg-surface)] border border-[var(--border-subtle)] focus:border-[var(--border-strong)] focus:bg-[var(--bg-surface-elevated)]"
          />
        </div>

        {/* Profile Menu — desktop only */}
        {user.role === 'admin' && (
          <div className="relative hidden md:block">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 px-2 py-1 rounded-lg border border-transparent hover:bg-[var(--bg-surface)] transition-colors"
            >
              <div className="w-6 h-6 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-center justify-center font-medium text-xs">
                {user.name?.charAt(0) || 'A'}
              </div>
              <span className="text-sm font-medium text-[var(--text-primary)]">{user.name?.split(' ')[0] || 'Account'}</span>
              <ChevronDown strokeWidth={1.5} className="w-3 h-3 text-[var(--text-tertiary)]" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl py-2 z-50 rounded-[12px] overflow-hidden animate-in fade-in zoom-in-95">
                <div className="px-4 py-2 border-b border-[var(--border-subtle)] mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium">View Mode</p>
                </div>
                
                <button 
                  onClick={() => setViewMode('admin')}
                  className="w-full text-left px-4 py-2 text-[13px] flex items-center justify-between hover:bg-[var(--bg-surface-elevated)] transition-colors text-[var(--text-primary)]"
                >
                  <span className={`flex items-center gap-2 ${viewMode === 'admin' ? 'text-[var(--accent-blue)]' : ''}`}>
                    <Shield strokeWidth={1.5} className="w-4 h-4" /> Admin View
                  </span>
                  {viewMode === 'admin' && <Check strokeWidth={2} className="w-3.5 h-3.5 text-[var(--accent-blue)]" />}
                </button>
                
                <button 
                  onClick={() => setViewMode('agent')}
                  className="w-full text-left px-4 py-2 text-[13px] flex items-center justify-between hover:bg-[var(--bg-surface-elevated)] transition-colors text-[var(--text-primary)]"
                >
                  <span className={`flex items-center gap-2 ${viewMode === 'agent' ? 'text-[var(--accent-blue)]' : ''}`}>
                    <User strokeWidth={1.5} className="w-4 h-4" /> Agent View
                  </span>
                  {viewMode === 'agent' && <Check strokeWidth={2} className="w-3.5 h-3.5 text-[var(--accent-blue)]" />}
                </button>

                <div className="h-px bg-[var(--border-subtle)] my-2"></div>
                
                <button className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors">
                  <Settings strokeWidth={1.5} className="w-4 h-4 text-[var(--text-tertiary)]" /> Settings
                </button>
                
                <button 
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-[13px] flex items-center gap-2 text-[var(--danger)] hover:bg-[var(--danger-dim)] transition-colors"
                >
                  <LogOut strokeWidth={1.5} className="w-4 h-4" /> Logout
                </button>
              </div>
            )}
          </div>
        )}

        {/* Mobile: just show avatar */}
        <div className="md:hidden">
          <div className="w-8 h-8 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center font-medium text-sm text-[var(--text-secondary)]">
            {user.name?.charAt(0) || 'A'}
          </div>
        </div>

        {/* Desktop-only: logout for non-admin and notification bell */}
        {user.role !== 'admin' && (
          <button onClick={handleLogout} className="p-2 rounded-lg text-[var(--text-tertiary)] hover:bg-[var(--danger-dim)] hover:text-[var(--danger)] transition-colors hidden md:block">
            <LogOut strokeWidth={1.5} className="w-4 h-4" />
          </button>
        )}
        
        <button 
          className="relative p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-lg border border-transparent hover:border-[var(--border-subtle)] transition-colors hidden md:block"
        >
          <Bell strokeWidth={1.5} className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[var(--danger)] rounded-full"></span>
        </button>
      </div>
    </header>
  );
}
