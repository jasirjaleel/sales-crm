import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Columns, Clock, GitBranch, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import MobileMenu from './MobileMenu';

export default function BottomNav() {
  const [showMenu, setShowMenu] = useState(false);
  const [overdueCount, setOverdueCount] = useState(0);
  const location = useLocation();

  // Fetch overdue follow-ups for badge
  useEffect(() => {
    const fetchOverdue = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
        const viewMode = user.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';
        let query = supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('completed', false)
          .lt('scheduled_at', new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString());
        if (viewMode !== 'admin') query = query.eq('agent_id', user.id);
        const { count } = await query;
        setOverdueCount(count || 0);
} catch { /* the badge is optional */ }
    };
    fetchOverdue();
    const interval = setInterval(fetchOverdue, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { name: 'Home', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Queue', path: '/leads/my-queue', icon: Columns },
    { name: 'Follow-Up', path: '/outreach/follow-ups', icon: Clock, badge: overdueCount },
    { name: 'Pipeline', path: '/leads/pipeline', icon: GitBranch },
  ];

  // Check if current path matches for active state
  const isActive = (path) => {
    if (path === '/dashboard') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  // Check if "More" contains the current active page
  const isMoreActive = !navItems.some(item => isActive(item.path));

  return (
    <>
      {/* Mobile Menu Overlay */}
      <MobileMenu isOpen={showMenu} onClose={() => setShowMenu(false)} />

      {/* Bottom Navigation Bar */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          height: `calc(var(--bottom-nav-height) + var(--safe-bottom))`,
          paddingBottom: 'var(--safe-bottom)',
          background: 'rgba(8, 8, 8, 0.95)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-around h-[var(--bottom-nav-height)] px-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className="flex flex-col items-center justify-center relative w-16 h-full"
              >
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center justify-center gap-1 relative"
                >
                  {/* Active indicator pill */}
                  {active && (
                    <motion.div
                      layoutId="bottomNavPill"
                      className="absolute -top-1 w-8 h-1 rounded-full"
                      style={{ background: 'linear-gradient(90deg, #D7C29B, #C8B48A)' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    />
                  )}

                  <div className="relative mt-1">
                    <item.icon 
                      className={`w-5 h-5 transition-colors duration-200 ${active ? 'text-[var(--accent)]' : 'text-[var(--muted-light)]'}`} 
                      strokeWidth={active ? 2.5 : 1.5} 
                    />
                    {/* Badge */}
                    {item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center bg-[var(--danger)] text-white text-[9px] font-mono rounded-full px-1 leading-none"
                        style={{ boxShadow: '0 0 8px rgba(255,90,90,0.4)' }}
                      >
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] font-mono uppercase tracking-widest transition-colors duration-200 ${active ? 'text-[var(--accent)]' : 'text-[var(--muted-light)]'}`}>
                    {item.name}
                  </span>
                </motion.div>
              </NavLink>
            );
          })}

          {/* More Button */}
          <button 
            onClick={() => setShowMenu(true)}
            className="flex flex-col items-center justify-center w-16 h-full relative"
          >
            <motion.div
              whileTap={{ scale: 0.88 }}
              className="flex flex-col items-center justify-center gap-1 relative"
            >
              {isMoreActive && (
                <motion.div
                  layoutId="bottomNavPill"
                  className="absolute -top-1 w-8 h-1 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #D7C29B, #C8B48A)' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                />
              )}
              <MoreHorizontal 
                className={`w-5 h-5 mt-1 transition-colors duration-200 ${showMenu || isMoreActive ? 'text-[var(--accent)]' : 'text-[var(--muted-light)]'}`} 
                strokeWidth={showMenu || isMoreActive ? 2.5 : 1.5} 
              />
              <span className={`text-[9px] font-mono uppercase tracking-widest transition-colors duration-200 ${showMenu || isMoreActive ? 'text-[var(--accent)]' : 'text-[var(--muted-light)]'}`}>
                More
              </span>
            </motion.div>
          </button>
        </div>
      </nav>
    </>
  );
}
