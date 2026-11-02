import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import BottomNav from './BottomNav';
import CreateLeadModal from '../Leads/CreateLeadModal';
import { useFollowUpNotifications } from '../../hooks/useFollowUpNotifications';
import { supabase } from '../../lib/supabase';

export default function Layout() {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('crm_sidebar') === 'true';
  });
  const [showCreateLead, setShowCreateLead] = useState(false);

  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  useFollowUpNotifications(user?.id);

  // buildWhatsAppLink is synchronous, so keep the team's active template cached locally
  useEffect(() => {
    supabase.from('whatsapp_templates').select('message').eq('is_active', true).maybeSingle().then(({ data }) => {
      if (data?.message) localStorage.setItem('crm_active_wa_template', data.message);
    });
  }, []);

  useEffect(() => {
    const handleOpenModal = () => setShowCreateLead(true);
    window.addEventListener('crm:openCreateLead', handleOpenModal);
    return () => window.removeEventListener('crm:openCreateLead', handleOpenModal);
  }, []);

  const toggleSidebar = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('crm_sidebar', newState);
  };

  return (
    <div className="flex h-screen text-[var(--text)] relative overflow-hidden ambient-bg">
      <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      
      <div className={`flex-1 transition-all duration-300 flex flex-col h-screen overflow-hidden relative z-10 ml-0 ${isCollapsed ? 'md:ml-[72px]' : 'md:ml-[280px]'}`}>
        {import.meta.env.VITE_DEMO_MODE === 'true' && (
          <div className="px-4 py-1.5 text-center text-[11px] font-mono uppercase tracking-widest text-[var(--muted-light)] border-b border-[var(--border-subtle)]">
            Demo with invented data. Resets every night.
          </div>
        )}
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-nav-safe md:pb-8 custom-scrollbar relative z-20">
          <div className="max-w-7xl mx-auto h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
        
        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </div>

      {showCreateLead && (
        <CreateLeadModal 
          onClose={() => setShowCreateLead(false)} 
          onSuccess={() => {
            window.dispatchEvent(new Event('crm:leadCreated'));
          }} 
        />
      )}
    </div>
  );
}
