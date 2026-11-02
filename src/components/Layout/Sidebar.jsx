import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

import { supabase } from '../../lib/supabase';
import { brand } from '../../lib/brand';
import { LayoutDashboard, Users, Columns, Mail, MessageCircle, Briefcase, FileBarChart, FileText, Settings, LogOut, Database, ChevronLeft, ChevronRight, ChevronDown, Clock, FileSignature, Receipt, PieChart } from 'lucide-react';

export default function Sidebar({ isCollapsed, toggleSidebar }) {
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const viewMode = user?.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';

  const [currentTime] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  });

  const [openSections, setOpenSections] = useState({
    'Leads': true,
    'Outreach': true,
    'Clients': true,
    'Forms': true,
  });

  const toggleSection = (title) => {
    setOpenSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  // --- Fetch Today's Progress ---
  const [progress, setProgress] = useState({ completed: 0, target: 30 });
  const [overdueCount, setOverdueCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Today's calls against this user's own target
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const { count: callsToday } = await supabase
          .from('call_logs')
          .select('id', { count: 'exact', head: true })
          .eq('agent_id', user.id)
          .gte('called_at', startOfToday.toISOString());
        setProgress({ completed: callsToday || 0, target: user.daily_target || 30 });

        // Follow-ups more than 5 hours past their time count as overdue
        const overdueBefore = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
        let overdueQuery = supabase
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('completed', false)
          .lt('scheduled_at', overdueBefore);
        if (viewMode !== 'admin') overdueQuery = overdueQuery.eq('agent_id', user.id);
        const { count: overdue } = await overdueQuery;
        setOverdueCount(overdue || 0);

} catch {
        // Silently fail
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user.id, user.daily_target, viewMode]);

  const pct = Math.min(Math.round((progress.completed / progress.target) * 100) || 0, 100);

  const navSections = viewMode === 'admin' ? [
    {
      title: 'Main',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Queue Manager', path: '/queue', icon: Users },
      ]
    },
    {
      title: 'Leads',
      items: [
        { name: 'Campaigns', path: '/leads/campaigns', icon: Database },
        { name: 'Global Database', path: '/leads/database', icon: Columns },
        { name: 'Pipeline', path: '/leads/pipeline', icon: FileText },
        { name: 'Import Leads', path: '/leads/import', icon: Database },
]
    },
    {
      title: 'Outreach',
      items: [
        { name: 'Follow Ups', path: '/outreach/follow-ups', icon: Clock },
        { name: 'WhatsApp', path: '/outreach/whatsapp', icon: MessageCircle },
        { name: 'Email', path: '/outreach/email', icon: Mail },
      ]
    },
    {
      title: 'Clients',
      items: [
        { name: 'Finance', path: '/finance/dashboard', icon: PieChart },
        { name: 'Quotations', path: '/finance/quotations', icon: FileSignature },
        { name: 'Invoices', path: '/finance/invoices', icon: Receipt },
        { name: 'Client Portal', path: '/clients/portal', icon: Briefcase },
{ name: 'Reports', path: '/clients/reports', icon: FileBarChart },
      ]
    },
    {
      title: 'Forms',
      items: [
        { name: 'Business Form', path: '/forms/business', icon: FileText },
        { name: 'Offer Form', path: '/forms/offer', icon: FileText },
        { name: 'Access Form', path: '/forms/access', icon: FileText },
      ]
    }
  ] : [
    {
      title: 'Main',
      items: [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      ]
    },
    {
      title: 'Leads',
      items: [
        { name: 'My Queue', path: '/leads/my-queue', icon: Columns },
        { name: 'My Pipeline', path: '/leads/pipeline', icon: FileText },
        { name: 'Follow Ups', path: '/outreach/follow-ups', icon: Clock },
]
    },
    {
      title: 'Outreach',
      items: [
        { name: 'WhatsApp', path: '/outreach/whatsapp', icon: MessageCircle },
        { name: 'Email', path: '/outreach/email', icon: Mail },
      ]
    },
    {
      title: 'Clients',
      items: [
        { name: 'Quotations', path: '/finance/quotations', icon: FileSignature },
      ]
    }
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_user');
    localStorage.removeItem('crm_admin_token');
    localStorage.removeItem('crm_view_mode');
    window.location.href = '/login';
  };

  return (
    <aside 
      className={`hidden md:flex h-screen flex-col fixed left-0 top-0 z-50 transition-all duration-300 ${isCollapsed ? 'w-[72px]' : 'w-[280px]'}`}
      style={{
        background: 'var(--bg-root)',
        borderRight: '1px solid var(--border-subtle)'
      }}
    >
      {/* Brand + Toggle */}
      <div className={`px-6 pt-6 pb-2 flex items-center justify-between ${isCollapsed ? 'justify-center px-4' : ''}`}>
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
              <span className="text-[var(--text-primary)] font-bold text-xs tracking-wider">{brand.name.charAt(0)}</span>
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight leading-none">
                {brand.name}
              </h1>
              <p className="text-[10px] uppercase text-[var(--text-tertiary)] tracking-widest mt-1">Workspace</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="w-7 h-7 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center">
            <span className="text-[var(--text-primary)] font-bold text-xs tracking-wider">{brand.name.charAt(0)}</span>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button 
        onClick={toggleSidebar}
        className="absolute -right-3 top-7 rounded-full p-1 z-50 transition-colors bg-[var(--bg-surface)] border border-[var(--border-strong)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)]"
      >
        {isCollapsed ? <ChevronRight strokeWidth={1.5} className="w-3 h-3" /> : <ChevronLeft strokeWidth={1.5} className="w-3 h-3" />}
      </button>

      {/* Welcome Section */}
      {!isCollapsed && (
        <div className="mx-4 mt-4 mb-2 p-4 rounded-[12px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
          <h2 className="font-medium text-sm text-[var(--text-primary)] leading-tight">
            Welcome back, {user.name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1 tracking-wide">
            Last login: {currentTime}
          </p>
        </div>
      )}
      
      {/* Navigation */}
      <div className="flex-1 px-3 space-y-4 mt-3 overflow-y-auto custom-scrollbar">
        {navSections.map((section, idx) => {
          const isSectionMinimized = !openSections[section.title];
          
          return (
            <div key={idx}>
              {!isCollapsed && (
                <div 
                  className="flex items-center justify-between px-3 mb-2 cursor-pointer group"
                  onClick={() => toggleSection(section.title)}
                >
                  <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-[0.1em] font-medium group-hover:text-[var(--text-secondary)] transition-colors">
                    {section.title}
                  </p>
                  <div className="text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)] transition-colors">
                    {isSectionMinimized ? <ChevronRight strokeWidth={1.5} className="w-3 h-3" /> : <ChevronDown strokeWidth={1.5} className="w-3 h-3" />}
                  </div>
                </div>
              )}
              
              {(!isSectionMinimized || isCollapsed) && (
                <div className="space-y-0.5 animate-in slide-in-from-top-2 duration-200">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      title={isCollapsed ? item.name : ''}
                      className={({ isActive }) =>
                        `flex items-center gap-3 py-2 rounded-lg transition-colors duration-150 text-[13px] ${isCollapsed ? 'justify-center px-0 mx-auto w-10 h-10' : 'px-3'} ${
                          isActive 
                            ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)]' 
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon strokeWidth={1.5} className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}`} />
                          {!isCollapsed && <span>{item.name}</span>}
                          
                          {/* Overdue Badge */}
                          {item.name === 'Follow Ups' && overdueCount > 0 && !isCollapsed && (
                            <span className="ml-auto bg-[var(--danger)] text-white text-[10px] font-medium rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                              {overdueCount > 99 ? '99+' : overdueCount}
                            </span>
                          )}
                          {item.name === 'Follow Ups' && overdueCount > 0 && isCollapsed && (
                            <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[var(--danger)] rounded-full border border-[var(--bg-root)]"></span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom */}
      <div className="px-4 py-4 border-t border-[var(--border-subtle)] mt-auto flex-shrink-0 bg-[var(--bg-root)]">
        {!isCollapsed && (
          <div className="mb-4">
            <div className="flex justify-between text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] font-medium mb-2">
              <span>Today's Progress</span>
              <span className="text-[var(--accent-blue)]">{progress.completed} / {progress.target}</span>
            </div>
            <div className="h-1 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[var(--accent-blue)] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
        
        {!isCollapsed && (
          <button className="flex items-center gap-3 px-3 py-2 w-full text-left text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] rounded-lg transition-colors text-[13px]">
            <Settings strokeWidth={1.5} className="w-4 h-4 text-[var(--text-tertiary)]" />
            Settings
          </button>
        )}
        <button 
          onClick={handleLogout}
          title={isCollapsed ? 'Logout' : ''}
          className={`flex items-center gap-3 py-2 w-full rounded-lg transition-colors mt-0.5 text-[13px] ${isCollapsed ? 'justify-center px-0 mx-auto w-10 h-10' : 'px-3 text-left'} text-[var(--danger)] hover:bg-[var(--danger-dim)]`}
        >
          <LogOut strokeWidth={1.5} className="w-4 h-4" />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
