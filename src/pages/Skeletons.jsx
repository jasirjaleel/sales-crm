import { Mail, Briefcase, FileText } from 'lucide-react';

export function EmailOutreach() {
  return <SkeletonPage title="Email Outreach." subtitle="Mass campaigns & sequencing" icon={<Mail className="w-12 h-12" />} />;
}

export function ClientPortal() {
  return <SkeletonPage title="Client Portal." subtitle="External dashboard for your clients" icon={<Briefcase className="w-12 h-12" />} />;
}

export function BusinessForm() {
  return <SkeletonPage title="Business Form." subtitle="Client Onboarding: Business Information" icon={<FileText className="w-12 h-12" />} />;
}

export function OfferForm() {
  return <SkeletonPage title="Offer Form." subtitle="Client Onboarding: Offer & Pricing" icon={<FileText className="w-12 h-12" />} />;
}

export function AccessForm() {
  return <SkeletonPage title="Access Form." subtitle="Client Onboarding: Credentials & Access" icon={<FileText className="w-12 h-12" />} />;
}

function SkeletonPage({ title, subtitle, icon }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 h-full flex flex-col">
      <div className="border-b border-[rgba(200,180,138,0.06)] pb-6 shrink-0">
        <h1 className="text-4xl heading-serif text-[var(--text)]">{title}</h1>
        <p className="text-[var(--muted)] mt-2 font-mono text-sm tracking-wider uppercase">{subtitle}</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center glass-card text-center p-12 relative overflow-hidden" style={{ borderStyle: 'dashed', borderWidth: '1px', borderColor: 'rgba(200, 180, 138, 0.10)' }}>
        {/* Warm glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(200, 180, 138, 0.06) 0%, transparent 70%)' }}
        ></div>
        <div className="text-[var(--accent)] mb-6 relative z-10 opacity-40">{icon}</div>
        <h2 className="text-3xl font-serif text-[var(--text)] mb-3 relative z-10">Coming Soon</h2>
        <p className="text-[var(--muted-light)] font-sans max-w-md relative z-10">
          This feature is currently under development. Check back later as we expand the CRM's capabilities.
        </p>
      </div>
    </div>
  );
}
