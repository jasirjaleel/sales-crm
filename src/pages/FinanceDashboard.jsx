import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { IndianRupee, FileText, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function FinanceDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    paidInvoices: 0,
    pendingAmount: 0,
    pendingInvoices: 0,
    cancelledInvoices: 0,
    outstandingAmount: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('invoices').select('*');
      if (error) throw error;
      
      let totalRevenue = 0;
      let paidInvoices = 0;
      let outstandingAmount = 0;
      let pendingInvoices = 0;
      let cancelledInvoices = 0;
      
      data.forEach(inv => {
        const netAmount = Number(inv.amount) - Number(inv.discount || 0);
        if (inv.status === 'Paid') {
          totalRevenue += netAmount;
          paidInvoices++;
        } else if (inv.status === 'Cancelled') {
          cancelledInvoices++;
        } else {
          // Unpaid, Partially Paid, Overdue
          outstandingAmount += netAmount;
          pendingInvoices++;
        }
      });

      setStats({
        totalRevenue,
        paidInvoices,
        pendingAmount: outstandingAmount,
        outstandingAmount,
        pendingInvoices,
        cancelledInvoices
      });
    } catch (err) {
      console.error('Error fetching finance stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full py-32">
        <div className="animate-pulse text-[var(--accent)] font-serif text-xl">Calculating Revenue...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex justify-between items-end border-b border-[rgba(200,180,138,0.06)] pb-6">
        <div>
          <h1 className="text-4xl heading-serif text-[var(--text)]">Finance.</h1>
          <p className="text-[var(--muted)] mt-2 font-mono text-sm tracking-wider uppercase">Revenue Dashboard</p>
        </div>
        <button 
          onClick={fetchStats}
          className="p-3 rounded-xl transition-all hover:text-[var(--accent)] hover:bg-[rgba(200,180,138,0.05)] text-[var(--muted-light)]"
          style={{ border: '1px solid rgba(200, 180, 138, 0.08)' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Revenue */}
        <div className="glass-card p-8 group relative overflow-hidden" style={{ border: '1px solid rgba(200,180,138,0.2)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)] rounded-full blur-[80px] opacity-10"></div>
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-xl bg-[rgba(200,180,138,0.1)] text-[var(--accent)]">
              <IndianRupee className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-[var(--success)] bg-[rgba(0,196,140,0.1)] px-2 py-1 rounded">PAID</span>
          </div>
          <h3 className="text-4xl font-serif text-[var(--text)]">{formatCurrency(stats.totalRevenue)}</h3>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mt-3">Total Collected Revenue</p>
        </div>

        {/* Outstanding */}
        <div className="glass-card p-8 relative overflow-hidden">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-xl bg-[rgba(247,185,85,0.1)] text-[var(--warning)]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-mono text-[var(--warning)] bg-[rgba(247,185,85,0.1)] px-2 py-1 rounded">PENDING</span>
          </div>
          <h3 className="text-4xl font-serif text-[var(--text)]">{formatCurrency(stats.outstandingAmount)}</h3>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mt-3">Outstanding Amount</p>
        </div>

        {/* Average Value */}
        <div className="glass-card p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] text-[var(--text)] border border-[rgba(255,255,255,0.05)]">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-4xl font-serif text-[var(--text)]">
            {stats.paidInvoices > 0 ? formatCurrency(stats.totalRevenue / stats.paidInvoices) : '₹0'}
          </h3>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--muted)] mt-3">Avg Client Value</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Paid Invoices</p>
            <p className="text-2xl font-serif text-[var(--text)]">{stats.paidInvoices}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-[var(--success)] opacity-20" />
        </div>
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Pending Invoices</p>
            <p className="text-2xl font-serif text-[var(--text)]">{stats.pendingInvoices}</p>
          </div>
          <AlertCircle className="w-8 h-8 text-[var(--warning)] opacity-20" />
        </div>
        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Cancelled Invoices</p>
            <p className="text-2xl font-serif text-[var(--text)]">{stats.cancelledInvoices}</p>
          </div>
          <FileText className="w-8 h-8 text-[var(--danger)] opacity-20" />
        </div>
      </div>
    </div>
  );
}
