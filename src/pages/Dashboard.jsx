import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, UploadCloud, PhoneCall, RefreshCw, UserPlus, Clock, FileText, Users, AlertCircle, BarChart2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import useMediaQuery from '../utils/useMediaQuery';
import { notifyError } from '../lib/notify';

// Call History & Target Chart Component
function CallHistoryChart({ data, summary }) {
  return (
    <div className="card-primitive p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="w-4 h-4 text-[var(--success-emerald)]" />
            <h3 className="text-sm font-mono uppercase tracking-widest text-[var(--text-primary)]">Outreach Activity & Trends</h3>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">Daily calls over the last 14 days vs. benchmark</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-[rgba(255,255,255,0.03)] px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-right">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--text-tertiary)]">Yesterday</p>
            <p className="text-sm font-medium text-[var(--text-primary)]">{summary.yesterday} Calls</p>
          </div>
          <div className="bg-[rgba(16,185,129,0.08)] px-3 py-1.5 rounded-xl border border-[rgba(16,185,129,0.2)] text-right">
            <p className="text-[9px] font-mono uppercase tracking-widest text-[var(--success-emerald)]">Today</p>
            <p className="text-sm font-medium text-[var(--success-emerald)]">{summary.today} Calls</p>
          </div>
        </div>
      </div>

      <div className="h-48 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontFamily: 'monospace' }} 
              allowDecimals={false}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-[#161616] border border-[rgba(255,255,255,0.12)] p-2.5 rounded-xl shadow-xl">
                      <p className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{item.date}</p>
                      <p className="text-xs font-medium text-[var(--success-emerald)]">{item.calls} Calls Completed</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="calls" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => {
                const isToday = index === data.length - 1;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={isToday ? '#10B981' : 'rgba(6, 78, 59, 0.55)'} 
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


// SVG Progress Ring Component
function ProgressRing({ percent, size = 120, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth={strokeWidth}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-emerald-light)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-circle"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-medium text-[var(--text-primary)]">{percent}%</span>
      </div>
    </div>
  );
}

// Animation variants
const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: 'easeOut' }
  })
};

export default function Dashboard() {
  const [queueStats, setQueueStats] = useState(null);
  const [followUpCounts, setFollowUpCounts] = useState({ dueNow: 0, overdue: 0 });
  const [listStats, setListStats] = useState({ count: 0, totalLeads: 0 });
  const [historicalChartData, setHistoricalChartData] = useState([]);
  const [dailyCallSummary, setDailyCallSummary] = useState({ today: 0, yesterday: 0 });
  const [quotationsPending, setQuotationsPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery('(max-width: 767px)');
  
  const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
  const viewMode = user?.role === 'admin' ? (localStorage.getItem('crm_view_mode') || 'admin') : 'agent';

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase.rpc('dashboard_stats', {
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        p_view: viewMode
      });
      if (error) throw error;

      setFollowUpCounts(data.followUps);
      setListStats(data.lists);
      setQuotationsPending(data.quotationsPending);
      setDailyCallSummary({ today: data.today, yesterday: data.yesterday });
      setHistoricalChartData(data.chart.map(day => ({
        ...day,
        date: new Date(`${day.rawDate}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })));

      const team = data.team.map(u => ({
        id: u.id,
        name: u.name,
        target: u.target,
        completed: u.completed,
        remaining: Math.max(0, u.target - u.completed),
        assigned: u.assigned,
        missingPhone: u.missing_phone,
        callable: u.callable,
        breakdown: [
          { outcome: 'interested', count: u.interested },
          { outcome: 'meeting_booked', count: u.meetings }
        ]
      }));

      setQueueStats({
        teamTarget: team.reduce((acc, u) => acc + u.target, 0) || 100,
        teamCompleted: team.reduce((acc, u) => acc + u.completed, 0),
        totalAvailable: data.totalAvailable,
        team
      });
    } catch (err) {
      notifyError(err, 'Could not load the dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once when the page opens
  }, []);

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const teamProgressPercent = queueStats ? Math.min(100, Math.round((queueStats.teamCompleted / queueStats.teamTarget) * 100)) : 0;

  // Agent Stats
  const agentStats = queueStats?.team?.find(u => u.id === user.id) || {
    target: 30, completed: 0, remaining: 0, breakdown: [], assigned: 0
  };
  const agentProgressPercent = agentStats.target > 0 ? Math.min(100, Math.round((agentStats.completed / agentStats.target) * 100)) : 0;
  
  const getCount = (userObj, key) => {
    const b = userObj?.breakdown?.find(x => x.outcome === key);
    return b ? parseInt(b.count) : 0;
  };

  // Which progress to show on mobile depends on role
  const mobilePercent = viewMode === 'admin' ? teamProgressPercent : agentProgressPercent;
  const mobileAssigned = viewMode === 'admin' ? (queueStats?.teamTarget || 0) : agentStats.target;
  const mobileCompleted = viewMode === 'admin' ? (queueStats?.teamCompleted || 0) : agentStats.completed;
  const mobileRemaining = viewMode === 'admin' ? (mobileAssigned - mobileCompleted) : agentStats.remaining;

  // Action center data
  const actionCenter = [
    { label: 'Follow-Ups Due Now', count: followUpCounts.dueNow, icon: <RefreshCw strokeWidth={1.5} className="w-4 h-4" />, action: 'Start Follow Ups', link: '/outreach/follow-ups' },
    { label: 'Overdue Follow-Ups', count: followUpCounts.overdue, icon: <AlertCircle strokeWidth={1.5} className="w-4 h-4" />, action: 'Clear Overdue', link: '/outreach/follow-ups' },
    { label: 'New Leads Remaining', count: viewMode === 'admin' ? queueStats?.totalAvailable || 0 : agentStats.callable || 0, icon: <PhoneCall strokeWidth={1.5} className="w-4 h-4" />, action: 'Call Next Lead', link: viewMode === 'admin' ? '/leads/database?start=true' : '/leads/my-queue?start=true' },
    { label: 'Quotations Pending', count: quotationsPending, icon: <FileText strokeWidth={1.5} className="w-4 h-4" />, action: 'Review Quotations', link: '/finance/quotations' },
  ];

  // Quick stats for mobile
  const interestedCount = viewMode === 'admin' 
    ? (queueStats?.team?.reduce((acc, u) => acc + getCount(u, 'interested'), 0) || 0) 
    : getCount(agentStats, 'interested');
  const meetingsCount = viewMode === 'admin'
    ? (queueStats?.team?.reduce((acc, u) => acc + getCount(u, 'meeting_booked'), 0) || 0)
    : getCount(agentStats, 'meeting_booked');

  if (loading) {
    return <div className="p-12 text-center text-[var(--text-tertiary)] text-sm animate-pulse">Loading Mission Control...</div>;
  }

  // ═══════════════════════════════════════════════
  // MOBILE DASHBOARD
  // ═══════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="space-y-4 pb-4">
        {/* Greeting */}
        <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants} className="px-4">
          <p className="text-[var(--text-tertiary)] text-[10px] uppercase tracking-widest font-medium mb-1">
            {currentDate}
          </p>
          <h1 className="text-2xl heading-serif text-[var(--text-primary)]">
            Today's Mission
          </h1>
        </motion.div>

        {/* Hero Mission Card with Progress Ring */}
        <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariants} className="card-primitive mx-4 p-5">
          <div className="flex items-center gap-6">
            <ProgressRing percent={mobilePercent} size={100} strokeWidth={6} />
            
            <div className="flex-1 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Assigned</span>
                <span className="text-xl font-medium text-[var(--text-primary)]">{mobileAssigned}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-[10px] uppercase tracking-widest text-[var(--success-emerald)]">Completed</span>
                <span className="text-xl font-medium text-[var(--success-emerald)]">{mobileCompleted}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-[var(--border-subtle)] pt-2">
                <span className="text-[10px] uppercase tracking-widest text-[var(--accent-blue)]">Remaining</span>
                <span className="text-xl font-medium text-[var(--accent-blue)]">{mobileRemaining}</span>
              </div>
            </div>
          </div>

          {/* Primary CTA */}
          <Link 
            to={viewMode === 'admin' ? '/leads/database?start=true' : '/leads/my-queue?start=true'}
            className="btn-primary w-full py-3.5 mt-6 text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2"
          >
            <Play strokeWidth={2} className="w-4 h-4 fill-current" /> Continue Outreach
          </Link>
        </motion.div>

        {/* Follow-Up Alert */}
        <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants} className="px-4">
          <Link to="/outreach/follow-ups" className="flex gap-3">
            <div className="flex-1 card-primitive p-4 flex items-center justify-between !bg-[var(--bg-surface-elevated)]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <Clock strokeWidth={1.5} className="w-3.5 h-3.5 text-[var(--accent-blue)]" />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Due Now</span>
                </div>
                <span className="text-xl font-medium text-[var(--text-primary)]">{followUpCounts.dueNow}</span>
              </div>
            </div>
            <div className="flex-1 card-primitive p-4 flex items-center justify-between !bg-[var(--danger-dim)] !border-[rgba(239,68,68,0.2)]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <AlertCircle strokeWidth={1.5} className="w-3.5 h-3.5 text-[var(--danger)]" />
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)]">Overdue</span>
                </div>
                <span className="text-xl font-medium text-[var(--danger)]">{followUpCounts.overdue}</span>
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Quick Stats */}
        <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants} className="flex gap-3 px-4">
          <div className="flex-1 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Interested</p>
            <p className="text-xl font-medium text-[var(--success-emerald)]">{interestedCount}</p>
          </div>
          <div className="flex-1 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Meetings</p>
            <p className="text-xl font-medium text-[#8B5CF6]">{meetingsCount}</p>
          </div>
          <div className="flex-1 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
            <p className="text-[9px] uppercase tracking-widest text-[var(--text-tertiary)] mb-1">Pool</p>
            <p className="text-xl font-medium text-[var(--accent-blue)]">{queueStats?.totalAvailable || 0}</p>
          </div>
        </motion.div>

        {/* Historical Outreach Activity Chart */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants} className="px-4 pt-2">
          <CallHistoryChart data={historicalChartData} summary={dailyCallSummary} />
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // DESKTOP DASHBOARD
  // ═══════════════════════════════════════════════
  return (
    <div className="space-y-6 pb-12 px-2">
      
      {/* Header & Quick Actions */}
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-[var(--border-subtle)] pb-6"
      >
        <div>
          <h1 className="text-3xl heading-serif text-[var(--text-primary)] flex items-center gap-4">
            Mission Dashboard.
          </h1>
          <p className="text-[var(--text-tertiary)] mt-2 flex items-center gap-2 text-xs tracking-wider uppercase font-medium">
            <Clock strokeWidth={1.5} className="w-3.5 h-3.5" />
            {currentDate}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          {viewMode === 'admin' && (
            <Link to="/leads/import" className="btn-secondary px-3 py-2 text-[11px] uppercase tracking-wider flex items-center gap-2">
              <UploadCloud strokeWidth={1.5} className="w-3.5 h-3.5" /> Upload Leads
            </Link>
          )}
          <Link to={viewMode === 'admin' ? '/leads/database?start=true' : '/leads/my-queue?start=true'} className="btn-secondary px-3 py-2 text-[11px] uppercase tracking-wider flex items-center gap-2">
            <PhoneCall strokeWidth={1.5} className="w-3.5 h-3.5" /> Start Calling
          </Link>
          <Link to="/outreach/follow-ups" className="btn-secondary px-3 py-2 text-[11px] uppercase tracking-wider flex items-center gap-2">
            <RefreshCw strokeWidth={1.5} className="w-3.5 h-3.5" /> Follow Ups
          </Link>
<button onClick={() => window.dispatchEvent(new Event('crm:openCreateLead'))} className="btn-primary px-3 py-2 text-[11px] uppercase tracking-wider flex items-center gap-2">
            <UserPlus strokeWidth={1.5} className="w-3.5 h-3.5" /> Add Lead
          </button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Today's Mission & Action Center */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Today's Mission */}
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="card-primitive p-8 relative overflow-hidden group"
          >
            <div className="relative z-10">
              <h2 className="text-2xl heading-serif text-[var(--text-primary)] mb-8">Today's Mission</h2>
              
              {viewMode === 'admin' ? (
                <>
                  {/* Per-Agent Cards (ADMIN ONLY) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                    {queueStats?.team.map((u, idx) => (
                      <motion.div 
                        key={u.id} 
                        custom={idx}
                        initial="hidden"
                        animate="visible"
                        variants={cardVariants}
                        className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] rounded-xl p-5"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-8 h-8 rounded bg-[var(--bg-surface)] border border-[var(--border-strong)] flex items-center justify-center text-xs text-[var(--text-secondary)] font-medium">
                            {u.name.charAt(0)}
                          </div>
                          <h3 className="font-medium text-base text-[var(--text-primary)] tracking-tight">{u.name}</h3>
                        </div>
                        <div className="space-y-2 text-[10px] uppercase tracking-widest font-medium">
                          <div className="flex justify-between text-[var(--text-tertiary)]">
                            <span>Target:</span> <span>{u.target}</span>
                          </div>
                          <div className="flex justify-between text-[var(--success-emerald)]">
                            <span>Completed:</span> <span>{u.completed}</span>
                          </div>
                          <div className="flex justify-between text-[var(--accent-blue)] pt-2 border-t border-[var(--border-subtle)] mt-2">
                            <span>Remaining:</span> <span>{u.remaining}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Team Completion */}
                  <div className="border-t border-[var(--border-subtle)] pt-6">
                    <div className="flex justify-between items-end mb-4">
                      <h3 className="font-medium text-lg text-[var(--text-primary)]">Team Completion</h3>
                      <span className="text-[10px] tracking-widest text-[var(--text-tertiary)] uppercase font-medium">
                        {queueStats?.teamCompleted} / {queueStats?.teamTarget}
                      </span>
                    </div>
                    
                    <div className="w-full h-2 rounded-full overflow-hidden mb-3 bg-[var(--bg-surface-elevated)]">
                      <div 
                        className="h-full bg-[var(--accent-blue)] transition-all duration-1000 ease-out"
                        style={{ width: `${teamProgressPercent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <p className="text-[var(--text-primary)] font-semibold text-2xl">{teamProgressPercent}%</p>
                      <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-widest font-medium">Remaining Pool: {queueStats?.totalAvailable}</span>
                    </div>
                  </div>
                  
                  {/* Big CTA */}
                  <div className="mt-8 flex flex-col md:flex-row gap-4">
                    <Link to="/leads/database?start=true" className="btn-primary flex-1 py-3 text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-2">
                      <Play strokeWidth={2} className="w-4 h-4 fill-current" /> Continue Outreach
                    </Link>
                    <Link to="/queue" className="btn-secondary px-8 py-3 text-[11px] uppercase tracking-[0.1em] flex items-center justify-center gap-2">
                      Manage Queue
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  {/* Agent Hero Metric */}
                  <div className="bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-8 rounded-xl mb-8">
                    <div className="flex items-center gap-10 mb-8">
                      <ProgressRing percent={agentProgressPercent} size={110} strokeWidth={8} />
                      <div className="flex-1 space-y-4">
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium">Target</span>
                          <span className="text-3xl font-medium text-[var(--text-primary)] tracking-tight">{agentStats.target}</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium">Completed</span>
                          <span className="text-3xl font-medium text-[var(--success-emerald)] tracking-tight">{agentStats.completed}</span>
                        </div>
                        <div className="flex justify-between items-baseline border-t border-[var(--border-subtle)] pt-3">
                          <span className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium">Remaining</span>
                          <span className="text-3xl font-medium text-[var(--warning)] tracking-tight">{agentStats.remaining}</span>
                        </div>
                      </div>
                    </div>

                    <Link to="/leads/my-queue?start=true" className="btn-primary w-full py-3.5 text-xs uppercase tracking-[0.1em] flex items-center justify-center gap-2">
                      <Play strokeWidth={2} className="w-4 h-4 fill-current" /> Continue Outreach
                    </Link>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* Action Center */}
          <div>
            <h3 className="heading-serif text-[var(--text-primary)] text-xl mb-4">
              Action Center
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {actionCenter.map((item, idx) => (
                <motion.div key={idx} custom={idx} initial="hidden" animate="visible" variants={cardVariants}>
                  <Link to={item.link} className="card-primitive p-5 hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-strong)] transition-colors block h-full">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex flex-col gap-1.5 text-[var(--text-primary)] text-[10px] uppercase tracking-widest font-medium">
                        <span className="text-[var(--accent-blue)] bg-[var(--accent-blue-dim)] p-1.5 w-max rounded-md">{item.icon}</span>
                        {item.label}
                      </div>
                      <span className="text-2xl font-medium text-[var(--text-primary)]">{item.count}</span>
                    </div>
                    <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-widest font-medium group-hover:text-[var(--text-secondary)] transition-colors">
                      {item.action} &rarr;
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Historical Outreach Activity Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            <CallHistoryChart data={historicalChartData} summary={dailyCallSummary} />
          </motion.div>

        </div>

        {/* RIGHT COLUMN: Sidebar Widgets */}
        <div className="space-y-6">
          
          {/* Team Overview */}
          {viewMode === 'admin' && (
            <motion.div 
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="card-primitive p-6"
            >
              <h4 className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium mb-5 flex items-center gap-2">
                <Users strokeWidth={1.5} className="w-3.5 h-3.5 text-[var(--accent-blue)]" /> Team Overview
              </h4>
              
              <div className="space-y-5">
                {queueStats?.team.map(u => {
                  const userPercent = u.target > 0 ? Math.min(100, Math.round((u.completed / u.target) * 100)) : 0;

                  return (
                    <div key={u.id} className="border-b border-[var(--border-subtle)] pb-5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-end mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-strong)] flex items-center justify-center text-[10px] text-[var(--text-secondary)] font-medium">
                            {u.name.charAt(0)}
                          </div>
                          <h5 className="font-medium text-[13px] text-[var(--text-primary)]">{u.name}</h5>
                        </div>
                        <span className="text-[10px] font-medium tracking-wide text-[var(--accent-blue)]">{userPercent}% Complete</span>
                      </div>
                      
                      <div className="w-full h-1.5 rounded-full overflow-hidden mb-3 bg-[var(--bg-surface-elevated)]">
                        <div className="h-full bg-[var(--accent-blue)] transition-all duration-500" style={{ width: `${userPercent}%` }}></div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 text-[9px] uppercase tracking-widest font-medium">
                        <div>
                          <p className="text-[var(--text-tertiary)] mb-1">Calls</p>
                          <p className="text-[var(--text-primary)] text-xs">{u.completed}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-tertiary)] mb-1">Interested</p>
                          <p className="text-[var(--success-emerald)] text-xs">{getCount(u, 'interested')}</p>
                        </div>
                        <div>
                          <p className="text-[var(--text-tertiary)] mb-1">Meetings</p>
                          <p className="text-[var(--text-primary)] text-xs">{getCount(u, 'meeting_booked')}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Lead Lists Stats */}
          {viewMode === 'admin' && (
            <div className="card-primitive p-6">
              <h4 className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium mb-5 flex items-center gap-2">
                <Users strokeWidth={1.5} className="w-3.5 h-3.5 text-[var(--accent-blue)]" /> Lead Campaigns
              </h4>
              <div className="space-y-3 text-[10px] uppercase tracking-widest font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)]">Active Lists</span>
                  <span className="text-[var(--text-primary)] text-xs">{listStats.count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[var(--text-tertiary)]">Total Leads Stored</span>
                  <span className="text-[var(--text-primary)] text-xs">{listStats.totalLeads}</span>
                </div>
                <Link to="/leads/campaigns" className="block text-center mt-3 text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] pt-3 border-t border-[var(--border-subtle)] transition-colors">
                  Manage Campaigns &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Queue Health */}
          <div className="card-primitive p-6">
            <h4 className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium mb-5 flex items-center gap-2">
              <PhoneCall strokeWidth={1.5} className="w-3.5 h-3.5 text-[var(--accent-blue)]" /> Queue Health
            </h4>
            <div className="space-y-3 text-[10px] uppercase tracking-widest font-medium">
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-tertiary)]">Assigned</span>
                <span className="text-[var(--text-primary)] text-xs">{viewMode === 'admin' ? (queueStats?.team.reduce((a,b) => a + (b.assigned || 0), 0) || 0) : (agentStats.assigned || 0)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[var(--danger)]">Missing Phone</span>
                <span className="text-[var(--danger)] text-xs">{viewMode === 'admin' ? (queueStats?.team.reduce((a,b) => a + (b.missingPhone || 0), 0) || 0) : (agentStats.missingPhone || 0)}</span>
              </div>
              <div className="border-t border-[var(--border-subtle)] pt-3 flex justify-between items-center">
                <span className="text-[var(--success-emerald)]">Callable</span>
                <span className="text-[var(--success-emerald)] text-sm">{viewMode === 'admin' ? (queueStats?.team.reduce((a,b) => a + (b.callable || 0), 0) || 0) : (agentStats.callable || 0)}</span>
              </div>
            </div>
          </div>

          {/* Outreach Funnel */}
          <div className="card-primitive p-6 hidden lg:block">
            <h4 className="text-[10px] uppercase tracking-widest text-[var(--text-tertiary)] font-medium mb-5">
              Outreach Funnel
            </h4>
            <div className="space-y-2.5 text-[10px] uppercase tracking-widest font-medium text-center">
              <div className="flex justify-between bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-3 rounded-lg">
                <span className="text-[var(--text-tertiary)]">Assigned</span>
                <span className="text-[var(--text-primary)]">{viewMode === 'admin' ? (queueStats?.team.reduce((a,b) => a + b.assigned, 0) || 0) : agentStats.assigned}</span>
              </div>
              <div className="text-[var(--border-strong)]">↓</div>
              <div className="flex justify-between bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-3 rounded-lg">
                <span className="text-[var(--text-tertiary)]">Called</span>
                <span className="text-[var(--text-primary)]">{viewMode === 'admin' ? (queueStats?.teamCompleted || 0) : agentStats.completed}</span>
              </div>
              <div className="text-[var(--border-strong)]">↓</div>
              <div className="flex justify-between bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] p-3 rounded-lg">
                <span className="text-[var(--text-tertiary)]">Interested</span>
                <span className="text-[var(--text-primary)]">{viewMode === 'admin' ? (queueStats?.team.reduce((acc, u) => acc + getCount(u, 'interested'), 0) || 0) : getCount(agentStats, 'interested')}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
