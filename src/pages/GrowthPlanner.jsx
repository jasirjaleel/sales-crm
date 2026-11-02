import { useState } from 'react';
import { TrendingUp, Calculator, Target } from 'lucide-react';

export default function GrowthPlanner() {
  const [revenueGoal, setRevenueGoal] = useState(100000);
  const [dealSize, setDealSize] = useState(15000);

  const clientsNeeded = dealSize > 0 ? Math.ceil(revenueGoal / dealSize) : 0;
  const meetingsNeeded = clientsNeeded * 3; // Assume 1 in 3 close rate
  const leadsNeeded = meetingsNeeded * 10; // Assume 10 leads to get 1 meeting
  const dailyTarget = Math.ceil(leadsNeeded / 21); // 21 working days

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 pt-8">
      
      <div className="text-center">
        <h1 className="text-4xl heading-serif text-[var(--text)] mb-2">Growth Planner</h1>
        <p className="text-[var(--muted)] font-mono text-sm tracking-widest uppercase flex items-center justify-center gap-2">
          <TrendingUp className="w-4 h-4 text-[var(--accent)]" /> Scale Your Agency
        </p>
      </div>

      <div className="glass-card p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-[0.04]">
          <Calculator className="w-32 h-32 text-[var(--accent)]" />
        </div>
        {/* Warm glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] pointer-events-none" 
          style={{ background: 'radial-gradient(ellipse at center, rgba(200,180,138,0.06), transparent 60%)' }}
        ></div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 relative z-10">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
              Monthly Revenue Goal (₹)
            </label>
            <input 
              type="number"
              value={revenueGoal}
              onChange={(e) => setRevenueGoal(Number(e.target.value))}
              className="w-full p-4 rounded-xl text-xl font-mono text-[var(--text)] focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">
              Average Deal Size (₹)
            </label>
            <input 
              type="number"
              value={dealSize}
              onChange={(e) => setDealSize(Number(e.target.value))}
              className="w-full p-4 rounded-xl text-xl font-mono text-[var(--text)] focus:outline-none transition-all"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(200,180,138,0.10)' }}
            />
          </div>
        </div>

        <div className="border-t border-[rgba(200,180,138,0.06)] pt-8 space-y-6 relative z-10">
          <h3 className="font-serif text-2xl text-[var(--text)]">The Math</h3>
          
          <div className="space-y-4 font-mono uppercase tracking-widest text-sm">
            <div className="flex justify-between items-center glass-card-subtle p-4" style={{ borderRadius: '12px' }}>
              <span className="text-[var(--muted-light)]">Clients Needed</span>
              <span className="text-xl text-[var(--text)] font-bold">{clientsNeeded}</span>
            </div>
            
            <div className="flex justify-between items-center glass-card-subtle p-4" style={{ borderRadius: '12px' }}>
              <span className="text-[var(--muted-light)]">Meetings Needed</span>
              <span className="text-xl text-[var(--text)] font-bold">{meetingsNeeded}</span>
            </div>
            
            <div className="flex justify-between items-center glass-card-subtle p-4" style={{ borderRadius: '12px' }}>
              <span className="text-[var(--muted-light)]">Total Leads Needed</span>
              <span className="text-xl text-[var(--text)] font-bold">{leadsNeeded}</span>
            </div>
          </div>

          <div className="mt-8 p-6 rounded-2xl text-center flex flex-col items-center justify-center" style={{ background: 'rgba(200,180,138,0.06)', border: '1px solid rgba(200,180,138,0.15)' }}>
            <Target className="w-8 h-8 text-[var(--accent)] mb-3" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--accent)] mb-1">Your Daily Action Target</p>
            <p className="font-serif text-4xl text-[var(--text)]">{dailyTarget} Leads / Day</p>
          </div>
        </div>

      </div>

    </div>
  );
}
