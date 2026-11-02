import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { stageLabel } from '../utils/pipeline';
import OwnerSummary from '../components/OwnerSummary';
import { notifyError } from '../lib/notify';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);

const PERIODS = [7, 30, 90];

function StatTile({ label, value }) {
  return (
    <div className="card-primitive p-5">
      <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-2">{label}</p>
      <p className="text-2xl font-medium tracking-tight text-[var(--text)]">{value}</p>
    </div>
  );
}

// Single-series horizontal bars. Every value is printed, so nothing depends on hover or colour.
function BarList({ rows, color }) {
  const max = Math.max(...rows.map(r => r.value), 1);
  return (
    <div className="space-y-3">
      {rows.map(row => (
        <div key={row.label} title={`${row.label}: ${row.value}${row.note ? ` (${row.note})` : ''}`}>
          <div className="flex justify-between gap-3 text-xs mb-1.5">
            <span className="text-[var(--text)] truncate">{row.label}</span>
            <span className="font-mono text-[var(--muted-light)] whitespace-nowrap">
              {row.value}{row.note ? ` · ${row.note}` : ''}
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(row.value / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('pipeline_report', { p_days: days }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) notifyError(error, 'Could not load reports.');
      else setReport(data);
    });
    return () => { cancelled = true; };
  }, [days]);

  useEffect(() => {
    supabase.rpc('owner_summary', { p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).then(({ data, error }) => {
      if (error) notifyError(error, 'Could not load the business summary.');
      else setSummary(data);
    });
  }, []);

  if (!report || !summary) {
    return <div className="p-12 text-center text-[var(--muted)] text-sm animate-pulse">Loading reports...</div>;
  }

  const top = report.funnel[0]?.leads || 0;
  const funnelRows = report.funnel.map(f => ({
    label: stageLabel(f.stage),
    value: f.leads,
    note: top > 0 ? `${Math.round((f.leads / top) * 100)}%` : null,
  }));
  const lostRows = report.lostReasons.map(r => ({ label: r.reason, value: r.leads }));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-[var(--border-subtle)] pb-6">
        <div>
          <h1 className="text-4xl heading-serif text-[var(--text)]">Reports.</h1>
          <p className="text-[var(--muted)] mt-2 font-mono text-xs tracking-wider uppercase">Pipeline and team performance</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Period for calls and wins">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setDays(p)}
              aria-pressed={days === p}
              className={`px-3 py-2 rounded-xl text-[10px] font-mono uppercase tracking-widest ${
                days === p ? 'bg-[var(--accent)] text-[#050505]' : 'bg-[var(--bg-surface-elevated)] text-[var(--muted-light)] border border-[var(--border-subtle)]'
              }`}
            >
              {p} days
            </button>
          ))}
        </div>
      </div>

      <OwnerSummary summary={summary} report={report} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Won Value (All Time)" value={formatINR(report.wonValue)} />
        <StatTile label={`Deals Won, ${days} Days`} value={report.wonInPeriod} />
        <StatTile label={`Calls, ${days} Days`} value={report.callsInPeriod} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="card-primitive p-6">
          <h2 className="text-lg heading-serif text-[var(--text)] mb-1">Conversion Funnel</h2>
          <p className="text-xs text-[var(--muted-light)] mb-5">All leads, by the furthest stage each one reached</p>
          {funnelRows.length ? <BarList rows={funnelRows} color="var(--success-emerald)" /> : <p className="text-sm text-[var(--muted)]">No leads yet.</p>}
        </section>

        <section className="card-primitive p-6">
          <h2 className="text-lg heading-serif text-[var(--text)] mb-1">Lost Reasons</h2>
          <p className="text-xs text-[var(--muted-light)] mb-5">All lost leads, by the reason recorded</p>
          {lostRows.length ? <BarList rows={lostRows} color="var(--muted-light)" /> : <p className="text-sm text-[var(--muted)]">No lost leads yet.</p>}
        </section>
      </div>

      <section className="card-primitive p-6">
        <h2 className="text-lg heading-serif text-[var(--text)] mb-1">Team Performance</h2>
        <p className="text-xs text-[var(--muted-light)] mb-5">Calls are for the last {days} days. Other columns cover each person's current leads.</p>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--border-subtle)]">
                {['Name', 'Calls', 'Leads', 'Interested', 'Meetings', 'Won', 'Lost', 'Won Value'].map((h, i) => (
                  <th key={h} scope="col" className={`py-3 pr-6 font-mono text-[10px] uppercase tracking-widest text-[var(--muted)] font-normal ${i > 0 ? 'text-right' : ''}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.agents.map(a => (
                <tr key={a.id} className="border-b border-[var(--border-subtle)] last:border-0">
                  <td className="py-3 pr-6 text-[var(--text)]">{a.name}</td>
                  {[a.calls, a.assigned, a.interested, a.meetings, a.won, a.lost, formatINR(a.won_value)].map((v, i) => (
                    <td key={i} className="py-3 pr-6 text-right font-mono text-[var(--text)]">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
