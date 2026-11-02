import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, FileSignature, Receipt, Database, Columns, MessageCircle, Users, TrendingUp, LogOut, Shield, User } from 'lucide-react';

export default function MobileMenu({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const viewMode = user?.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';

  const handleNav = (path) => {
    navigate(path);
    onClose();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_admin_token');
    localStorage.removeItem('crm_view_mode');
    window.location.href = '/login';
  };

  const handleViewModeToggle = (mode) => {
    localStorage.setItem('crm_view_mode', mode);
    window.location.reload();
  };

  // Quick Actions
  const allQuickActions = [
{ 
      label: 'Add Lead', 
      icon: UserPlus, 
      color: 'text-[var(--text-primary)]',
      bg: 'bg-[var(--accent-blue)] text-white',
      border: 'border-transparent',
      action: () => { onClose(); window.dispatchEvent(new Event('crm:openCreateLead')); }
    },
    { 
      label: 'Quotation', 
      icon: FileSignature, 
      color: 'text-[var(--text-primary)]',
      bg: 'bg-[var(--bg-surface-elevated)]',
      border: 'border-[var(--border-subtle)]',
      action: () => handleNav('/finance/quotations')
    },
    { 
      label: 'Invoice', 
      icon: Receipt, 
      color: 'text-[var(--text-primary)]',
      bg: 'bg-[var(--bg-surface-elevated)]',
      border: 'border-[var(--border-subtle)]',
      action: () => handleNav('/finance/invoices'),
      adminOnly: true
    },
  ];
  const quickActions = allQuickActions.filter(a => !a.adminOnly || user.role === 'admin');

  // Navigation sections based on role
  const navLinks = viewMode === 'admin' ? [
    { label: 'Campaigns', icon: Database, path: '/leads/campaigns' },
    { label: 'Global Database', icon: Columns, path: '/leads/database' },
    { label: 'Queue Manager', icon: Users, path: '/queue' },
    { label: 'WhatsApp', icon: MessageCircle, path: '/outreach/whatsapp' },
    { label: 'Quotations', icon: FileSignature, path: '/finance/quotations' },
    { label: 'Invoices', icon: Receipt, path: '/finance/invoices' },
    { label: 'Finance', icon: Receipt, path: '/finance/dashboard' },
    { label: 'Reports', icon: TrendingUp, path: '/clients/reports' },
    { label: 'Growth Planner', icon: TrendingUp, path: '/settings/growth' },
] : [
    { label: 'WhatsApp', icon: MessageCircle, path: '/outreach/whatsapp' },
    { label: 'Quotations', icon: FileSignature, path: '/finance/quotations' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[55] md:hidden"
          />

          {/* Menu Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) {
                onClose();
              }
            }}
            className="fixed bottom-0 left-0 right-0 z-[60] md:hidden rounded-t-[20px] overflow-hidden"
            style={{
              background: 'var(--bg-surface)',
              borderTop: '1px solid var(--border-subtle)',
              maxHeight: '85vh',
              paddingBottom: 'var(--safe-bottom)',
            }}
          >
            {/* Drag Handle */}
            <div className="flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1.5 rounded-full bg-[var(--border-strong)]" />
            </div>

            <div className="px-5 pb-6 overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(85vh - 60px)' }}>
              
              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={action.action}
                    className={`flex flex-col items-center justify-center gap-2 py-4 rounded-xl border transition-all active:scale-95 ${action.bg} ${action.border}`}
                  >
                    <action.icon strokeWidth={1.5} className="w-5 h-5" />
                    <span className="text-[10px] uppercase tracking-widest font-medium">{action.label}</span>
                  </button>
                ))}
              </div>

              {/* Section Divider */}
              <div className="h-px bg-[var(--border-subtle)] mb-4" />

              {/* Navigation Links */}
              <div className="space-y-1 mb-6">
                <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] font-medium px-3 mb-3">Navigation</p>
                {navLinks.map((link) => {
                  const active = location.pathname === link.path;
                  return (
                    <button
                      key={link.label}
                      onClick={() => handleNav(link.path)}
                      className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${
                        active 
                          ? 'bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]'
                          : 'border border-transparent hover:bg-[var(--bg-surface-elevated)]'
                      }`}
                    >
                      <link.icon strokeWidth={1.5} className={`w-5 h-5 ${active ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}`} />
                      <span className={`text-[13px] ${active ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                        {link.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Admin View Switcher */}
              {user.role === 'admin' && (
                <>
                  <div className="h-px bg-[var(--border-subtle)] mb-4" />
                  <div className="mb-6">
                    <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--text-tertiary)] font-medium px-3 mb-3">View Mode</p>
                    <div className="flex gap-2 px-3">
                      <button
                        onClick={() => handleViewModeToggle('admin')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs tracking-wide transition-all ${
                          viewMode === 'admin'
                            ? 'bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] text-[var(--accent-blue)] font-medium'
                            : 'bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Shield strokeWidth={1.5} className="w-4 h-4" />
                        Admin
                      </button>
                      <button
                        onClick={() => handleViewModeToggle('agent')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs tracking-wide transition-all ${
                          viewMode === 'agent'
                            ? 'bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] text-[var(--accent-blue)] font-medium'
                            : 'bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <User strokeWidth={1.5} className="w-4 h-4" />
                        Agent
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* User Section */}
              <div className="h-px bg-[var(--border-subtle)] mb-4" />
              <div className="flex items-center justify-between px-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] flex items-center justify-center font-medium text-sm text-[var(--text-secondary)]">
                    {user.name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{user.name || 'User'}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-medium">{user.role || 'agent'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[var(--danger)] text-xs font-medium border border-transparent hover:bg-[var(--danger-dim)] hover:border-[rgba(239,68,68,0.2)] transition-colors active:scale-95"
                >
                  <LogOut strokeWidth={1.5} className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
