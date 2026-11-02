import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { updateLead } from '../../lib/leads';
import { resolveOutcome, stageAfterOutcome, followUpTime, stageLabel, stageColor } from '../../utils/pipeline';
import { notify, notifyError } from '../../lib/notify';
import DealPanel from './DealPanel';
import AssistantPanel from './AssistantPanel';
import { X, Phone, Globe, MapPin, Building, MessageCircle, PhoneCall, Clock, CheckCircle, FileSignature, IndianRupee, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import { buildWhatsAppLink } from '../../utils/whatsapp';
import { motion, AnimatePresence } from 'framer-motion';
import useMediaQuery from '../../utils/useMediaQuery';
import SuccessOverlay from './SuccessOverlay';
import html2pdf from 'html2pdf.js';
import DocumentPDFTemplate from '../Finance/DocumentPDFTemplate';

// Content slide variants for Save & Next
const contentVariants = {
  enter: { x: 80, opacity: 0 },
  center: { x: 0, opacity: 1, transition: { type: 'spring', damping: 28, stiffness: 300 } },
  exit: { x: -80, opacity: 0, transition: { duration: 0.15 } }
};

const localDateString = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function LeadDrawer({ leadId, onClose, onNext }) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingQuote, setDownloadingQuote] = useState(null);
  const pdfRef = React.useRef(null);
  const isMobile = useMediaQuery('(max-width: 767px)');

  // Collapsible sections (mobile)
  const [showWebsiteReview, setShowWebsiteReview] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Call Outcome State
  const [outcome, setOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [customTime, setCustomTime] = useState('10:00');
  const [customDate, setCustomDate] = useState('');
const [isSavingOutcome, setIsSavingOutcome] = useState(false);

  // Success overlay
  const [showSuccess, setShowSuccess] = useState(null); // null or { label: string }

  // Website Review State
  const [websiteStatus, setWebsiteStatus] = useState('not_checked');
  const [websiteNotes, setWebsiteNotes] = useState('');
  const [isSavingWebsite, setIsSavingWebsite] = useState(false);

  // Quotation State
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [quotationData, setQuotationData] = useState({
    service: '',
    price: '',
    timeline: '',
    deliverables: '',
    terms: '50% upfront payment to commence work. Balance upon completion.'
  });
  const [isSubmittingQuotation, setIsSubmittingQuotation] = useState(false);

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('leads').select('*, call_logs(*), follow_ups(*), lead_stage_events(*)').eq('id', leadId).single();
      if (error) throw error;
      setLead(data);
      setWebsiteStatus(data.website_status || 'not_checked');
      setWebsiteNotes(data.website_notes || '');
    } catch (err) {
      notifyError(err, 'Could not load this lead.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (leadId) {
      fetchLeadDetails();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the lead changes
  }, [leadId]);

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingQuotation(true);
      
      const { data, error } = await supabase.from('quotations').insert({
        ...quotationData,
        lead_id: leadId,
      }).select().single();
      
      if (error) throw error;
      
      // Add lead context for the PDF generation
      const quoteWithLead = {
        ...data,
        lead_name: lead?.name,
        lead_email: lead?.email,
        lead_phone: lead?.phone
      };

      setDownloadingQuote(quoteWithLead);
      
      // Wait for React to render the hidden PDF template before capturing
      setTimeout(() => {
        const element = pdfRef.current;
        if (!element) return;
        html2pdf().set({
          margin:       0,
          filename:     `Quotation_${data.id}_${lead?.name || 'Lead'}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true },
          jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        }).from(element).save().then(() => {
          notify('Quotation generated and downloaded.');
          setShowQuotationForm(false);
        }).catch((pdfError) => {
          notifyError(pdfError, 'The quotation was saved, but its PDF could not be created.');
        }).finally(() => {
          setDownloadingQuote(null);
          setIsSubmittingQuotation(false);
        });
      }, 500);

    } catch (err) {
      notifyError(err, 'Error creating quotation.');
setIsSubmittingQuotation(false);
    }
  };

  const handleSaveWebsiteReview = async (newStatus, newNotes) => {
    try {
      setIsSavingWebsite(true);
      const updateData = {
        website_status: newStatus !== undefined ? newStatus : websiteStatus,
        website_notes: newNotes !== undefined ? newNotes : websiteNotes,
      };
      await updateLead(leadId, updateData);
setLead(prev => ({ 
        ...prev, 
        website_status: newStatus !== undefined ? newStatus : websiteStatus,
        website_notes: newNotes !== undefined ? newNotes : websiteNotes 
      }));
    } catch (err) {
      notifyError(err, 'Could not save the website review.');
    } finally {
      setIsSavingWebsite(false);
    }
  };

  const handleSaveAndNext = async (selectedOutcome = outcome) => {
    if (!selectedOutcome) return notify('Please select an outcome first', 'error');
    const resolved = resolveOutcome(selectedOutcome);
    if (!resolved) return;

    let scheduledAt = followUpTime(resolved.followUp);
    if (resolved.followUp === 'custom') {
      if (!customDate || !customTime) {
        return notify('Please select a date and time for the follow up', 'error');
      }
      scheduledAt = new Date(`${customDate}T${customTime}`);
      if (Number.isNaN(scheduledAt.getTime())) {
        return notify('That date or time is not valid', 'error');
      }
    }

    try {
      setIsSavingOutcome(true);

      const user = JSON.parse(localStorage.getItem('crm_user') || '{}');
      const nextStage = stageAfterOutcome(lead?.status, selectedOutcome);

      const { error: logError } = await supabase.from('call_logs').insert({
        lead_id: leadId,
        agent_id: user.id,
        outcome: resolved.outcome,
        notes: outcomeNotes.trim()
      });
      if (logError) throw logError;

      const leadChanges = {
        status: nextStage,
        last_outcome: resolved.outcome,
        last_called_at: new Date().toISOString()
      };
      if (nextStage === 'lost' && resolved.lostReason) leadChanges.lost_reason = resolved.lostReason;
      await updateLead(leadId, leadChanges);

      // Auto-complete any existing pending follow-ups for this lead to prevent duplicates
      const { error: closeError } = await supabase.from('follow_ups')
        .update({ completed: true })
        .eq('lead_id', leadId)
        .eq('completed', false);
      if (closeError) throw closeError;

      if (scheduledAt) {
        const { error: followUpError } = await supabase.from('follow_ups').insert({
          lead_id: leadId,
          agent_id: user.id,
          scheduled_at: scheduledAt.toISOString(),
          notes: outcomeNotes.trim(),
        });
        if (followUpError) throw followUpError;
      }

      // Show success overlay
      setShowSuccess({ label: resolved.label });

      // After overlay, transition to next lead
      setTimeout(() => {
        setShowSuccess(null);
        // Reset state for next lead
        setOutcome('');
        setOutcomeNotes('');
        setCustomTime('10:00');
        setCustomDate('');
        setShowWebsiteReview(false);
        setShowNotes(false);
        setShowTimeline(false);

        if (onNext) {
          onNext();
        } else {
          onClose();
        }
      }, 400);

    } catch (err) {
      notifyError(err, 'Failed to save outcome.');
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => (
    <span
      className="px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest bg-[rgba(255,255,255,0.06)]"
      style={{ color: stageColor(status) }}
    >
      {stageLabel(status)}
    </span>
  );

  return createPortal(
    <AnimatePresence>
      {/* Backdrop overlay */}
      <motion.div 
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-[100]"
        onClick={onClose}
      />
      
      {/* Slide-out Drawer / Bottom Sheet */}
      <motion.div 
        key="drawer"
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        drag={isMobile ? "y" : false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={(e, { offset, velocity }) => {
          if (offset.y > 100 || velocity.y > 500) {
            onClose();
          }
        }}
        className="fixed bottom-0 left-0 w-full h-[90vh] rounded-t-[28px] md:top-0 md:bottom-auto md:left-auto md:right-0 md:w-[600px] md:h-full md:rounded-none z-[110] flex flex-col shadow-2xl"
        style={{
          background: 'var(--bg-root)',
          borderLeft: '1px solid var(--border-subtle)',
          borderTop: '1px solid var(--border-subtle)'
        }}
      >
        {/* Success Overlay */}
        <AnimatePresence>
          {showSuccess && (
            <SuccessOverlay 
              outcomeLabel={showSuccess.label}
              onDone={() => {}}
              duration={400}
            />
          )}
        </AnimatePresence>

        {/* Drag Handle for Mobile */}
        <div className="md:hidden w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="bottom-sheet-handle" />
        </div>

        {/* Animated Content — keyed by leadId for Save & Next transitions */}
        <AnimatePresence mode="wait">
          <motion.div
            key={leadId}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 md:px-6 py-4 md:py-6 border-b border-[rgba(200,180,138,0.06)] flex justify-between items-start">
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="h-7 w-48 bg-white/5 rounded animate-pulse mb-2"></div>
                ) : (
                  <h2 className="text-2xl md:text-3xl font-serif text-[var(--text)] mb-1 truncate pr-2">{lead?.name || 'Unknown Business'}</h2>
                )}
                <div className="flex gap-2 items-center flex-wrap">
                  {!loading && lead && getStatusBadge(lead.status)}
                  {!loading && lead && lead.call_logs && (
                    <span className="text-[10px] font-mono text-[var(--accent)] uppercase tracking-widest bg-[rgba(200,180,138,0.1)] px-2 py-0.5 rounded">
                      Attempts: {lead.call_logs.length}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-white/5 text-[var(--muted)] hover:text-white transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-5 md:px-6 py-4 md:py-6 space-y-5 md:space-y-8">
              {loading ? (
                <div className="space-y-4">
                  <div className="h-20 bg-white/5 rounded-xl animate-pulse"></div>
                  <div className="h-40 bg-white/5 rounded-xl animate-pulse"></div>
                </div>
              ) : (
                <>
                  {/* Quick Actions — Call & WhatsApp (prominent on mobile) */}
                  {lead?.phone && (
                    <div className="flex gap-3">
                      <a 
                        href={`tel:${lead.phone}`}
                        className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-mono text-sm uppercase tracking-widest transition-all active:scale-95"
                        style={{ 
                          background: 'linear-gradient(180deg, #D7C29B, #C8B48A)',
                          color: '#050505',
                          boxShadow: '0 4px 20px rgba(200,180,138,0.2)'
                        }}
                      >
                        <PhoneCall className="w-5 h-5" /> Call
                      </a>
                      <a 
                        href={buildWhatsAppLink(lead.phone, lead.name)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-mono text-sm uppercase tracking-widest bg-[#25D366] text-white transition-all active:scale-95"
                        style={{ boxShadow: '0 4px 20px rgba(37,211,102,0.2)' }}
                      >
                        <MessageCircle className="w-5 h-5" /> WhatsApp
                      </a>
                    </div>
                  )}

                  {/* Contact Info */}
                  <div className="space-y-3">
                    {lead.phone && (
                      <div className="flex items-center gap-3 text-[var(--text)] text-sm">
                        <Phone className="w-4 h-4 text-[var(--muted-light)] flex-shrink-0" />
                        <span className="font-mono">{lead.phone}</span>
                      </div>
                    )}
                    {lead.website && (
                      <div className="flex items-center gap-3 text-[var(--text)] text-sm">
                        <Globe className="w-4 h-4 text-[var(--muted-light)] flex-shrink-0" />
                        <a href={lead.website} target="_blank" rel="noreferrer" className="hover:text-[var(--accent)] underline decoration-[rgba(200,180,138,0.3)] underline-offset-4 transition-colors truncate">
                          {lead.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {lead.location && (
                      <div className="flex items-center gap-3 text-[var(--text)] text-sm">
                        <MapPin className="w-4 h-4 text-[var(--muted-light)] flex-shrink-0" />
                        <span>{lead.location}</span>
                      </div>
                    )}
                    {lead.category && (
                      <div className="flex items-center gap-3 text-[var(--text)] text-sm">
                        <Building className="w-4 h-4 text-[var(--muted-light)] flex-shrink-0" />
                        <span>{lead.category}</span>
                      </div>
                    )}
                  </div>

                  {/* Stage, deal value and close date */}
                  <DealPanel key={`${lead.id}-${lead.status}`} lead={lead} onChanged={fetchLeadDetails} />

                  <AssistantPanel key={`ai-${lead.id}`} lead={{ ...lead, id: leadId }} />

                  {/* Generate Quotation */}
<button 
                    onClick={() => setShowQuotationForm(true)}
                    className="btn-secondary w-full py-3 flex justify-center items-center gap-2 text-sm"
                  >
                    <FileSignature className="w-4 h-4" /> Generate Quotation
                  </button>

                  {/* Collapsible: Website Review */}
                  {isMobile ? (
                    <CollapsibleSection 
                      title="Website Review" 
                      icon={Globe} 
                      isOpen={showWebsiteReview} 
                      toggle={() => setShowWebsiteReview(!showWebsiteReview)}
                    >
                      <WebsiteReviewContent 
                        lead={lead} websiteStatus={websiteStatus} setWebsiteStatus={setWebsiteStatus}
                        websiteNotes={websiteNotes} setWebsiteNotes={setWebsiteNotes}
                        handleSaveWebsiteReview={handleSaveWebsiteReview} isSavingWebsite={isSavingWebsite}
                      />
                    </CollapsibleSection>
                  ) : (
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[var(--accent)]" /> Website Review
                      </h3>
                      <WebsiteReviewContent 
                        lead={lead} websiteStatus={websiteStatus} setWebsiteStatus={setWebsiteStatus}
                        websiteNotes={websiteNotes} setWebsiteNotes={setWebsiteNotes}
                        handleSaveWebsiteReview={handleSaveWebsiteReview} isSavingWebsite={isSavingWebsite}
                      />
                    </div>
                  )}

                  {/* Collapsible: Notes */}
                  {isMobile ? (
                    <CollapsibleSection 
                      title="Notes" 
                      isOpen={showNotes} 
                      toggle={() => setShowNotes(!showNotes)}
                    >
                      <div className="glass-card-subtle p-4 rounded-xl min-h-[80px] text-sm text-[var(--text)] border border-[rgba(200,180,138,0.06)] leading-relaxed whitespace-pre-wrap mb-3">
                        {lead.notes || <span className="text-[var(--muted-light)] italic">No notes available.</span>}
                      </div>
                    </CollapsibleSection>
                  ) : (
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">Notes</h3>
                      <div className="glass-card-subtle p-4 rounded-xl min-h-[100px] text-sm text-[var(--text)] border border-[rgba(200,180,138,0.06)] leading-relaxed whitespace-pre-wrap">
                        {lead.notes || <span className="text-[var(--muted-light)] italic">No notes available.</span>}
                      </div>
                    </div>
                  )}

                  {/* Collapsible: Timeline */}
                  {isMobile ? (
                    <CollapsibleSection 
                      title={`Activity (${(lead.call_logs?.length || 0) + (lead.follow_ups?.length || 0)})`}
                      icon={Clock}
                      isOpen={showTimeline} 
                      toggle={() => setShowTimeline(!showTimeline)}
                    >
                      <TimelineContent lead={lead} formatDate={formatDate} />
                    </CollapsibleSection>
                  ) : (
                    <div>
                      <h3 className="text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-4">Activity Timeline</h3>
                      <TimelineContent lead={lead} formatDate={formatDate} />
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Outcome Footer — always visible */}
            {!loading && lead && (
              <div className="p-4 md:p-5 border-t border-[rgba(200,180,138,0.06)] bg-[rgba(10,10,10,0.98)] flex-shrink-0">
                <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[var(--muted)] mb-3">What happened?</h3>
                
                {/* Primary Outcomes — 3 columns */}
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {[
                    { key: 'no_answer', label: 'No Answer', emoji: '📞', color: 'muted-light', border: 'rgba(255,255,255,0.08)', bg: 'rgba(255,255,255,0.02)' },
                    { key: 'send_info', label: 'Send Info', emoji: '📧', color: 'success', border: 'rgba(0,196,140,0.2)', bg: 'rgba(0,196,140,0.05)' },
                    { key: 'not_interested', label: 'Not Interested', emoji: '🚫', color: 'danger', border: 'rgba(255,90,90,0.2)', bg: 'rgba(255,90,90,0.05)' },
                  ].map(item => (
                    <button
                      key={item.key}
                      disabled={isSavingOutcome}
                      onClick={() => handleSaveAndNext(item.key)}
                      className="py-3 md:py-4 rounded-xl text-[11px] md:text-xs font-mono text-center transition-all border active:scale-95 flex flex-col items-center gap-0.5 hover:bg-[rgba(255,255,255,0.05)]"
                      style={{ 
                        borderColor: item.border, 
                        background: item.bg,
                        color: item.color.startsWith('#') ? item.color : `var(--${item.color})`
                      }}
                    >
                      <span className="text-lg leading-none mb-1">{item.emoji}</span>
                      <span className="leading-tight">{item.label}</span>
                    </button>
                  ))}
                </div>

                {/* Schedule Call Back */}
                <button 
                  disabled={isSavingOutcome}
                  onClick={() => {
                    setOutcome('call_back');
                    if (!customDate) {
                      const tmrw = new Date();
                      tmrw.setDate(tmrw.getDate() + 1);
                      setCustomDate(localDateString(tmrw));
                      setCustomTime('10:00');
                    }
                  }}
                  className="w-full py-3 mb-2 rounded-xl text-xs font-mono text-center transition-all border active:scale-95 flex items-center justify-center gap-2"
                  style={{ borderColor: 'rgba(247,185,85,0.2)', background: 'rgba(247,185,85,0.05)', color: 'var(--warning)' }}
                >
                  <span className="text-base">⏱️</span> Schedule Call Back
                </button>

                {/* Call Back Date/Time Picker */}
                <AnimatePresence>
                  {outcome === 'call_back' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mb-2 p-3 border border-[rgba(247,185,85,0.2)] rounded-xl bg-[rgba(247,185,85,0.05)]">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono text-[var(--warning)] uppercase tracking-widest">Schedule Follow-up</span>
                          <button onClick={() => setOutcome('')} className="text-[var(--muted)] hover:text-white"><X className="w-3 h-3"/></button>
                        </div>
                        <div className="flex flex-col gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] text-[var(--muted-light)] block font-mono uppercase tracking-widest">Select Date</label>
                            <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                              {[
                                { label: 'Today', days: 0 },
                                { label: 'Tmrw', days: 1 },
                                { label: '3 Days', days: 3 },
                                { label: '1 Week', days: 7 }
                              ].map(preset => {
                                const d = new Date();
                                d.setDate(d.getDate() + preset.days);
                                const dateStr = localDateString(d);
                                return (
                                  <button
                                    key={preset.label}
                                    onClick={() => setCustomDate(dateStr)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap transition-colors border ${
                                      customDate === dateStr 
                                        ? 'bg-[var(--warning)] text-black border-[var(--warning)]' 
                                        : 'bg-[rgba(255,255,255,0.02)] text-[var(--muted)] border-[rgba(255,255,255,0.1)] hover:border-[var(--warning)] hover:text-[var(--warning)]'
                                    }`}
                                  >
                                    {preset.label}
                                  </button>
                                );
                              })}
                            </div>
                            <input 
                              type="date" 
                              value={customDate}
                              onChange={e => setCustomDate(e.target.value)}
                              className="w-full bg-[rgba(12,12,12,0.5)] border border-[rgba(255,255,255,0.05)] rounded-lg p-2.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--warning)]"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] text-[var(--muted-light)] block font-mono uppercase tracking-widest">Select Time</label>
                            <div className="grid grid-cols-4 gap-2">
                              {['09:00', '12:00', '15:00', '17:00'].map(timePreset => {
                                const formatAmPm = (t) => {
                                  const [h, m] = t.split(':');
                                  const hour = parseInt(h);
                                  return `${hour > 12 ? hour - 12 : hour}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
                                };
                                return (
                                  <button
                                    key={timePreset}
                                    onClick={() => setCustomTime(timePreset)}
                                    className={`px-2 py-2 rounded-lg text-[10px] font-mono transition-colors border ${
                                      customTime === timePreset
                                        ? 'bg-[var(--warning)] text-black border-[var(--warning)]'
                                        : 'bg-[rgba(255,255,255,0.02)] text-[var(--muted)] border-[rgba(255,255,255,0.1)] hover:border-[var(--warning)] hover:text-[var(--warning)]'
                                    }`}
                                  >
                                    {formatAmPm(timePreset)}
                                  </button>
                                );
                              })}
                            </div>
                            <input 
                              type="time" 
                              value={customTime}
                              onChange={e => setCustomTime(e.target.value)}
                              className="w-full bg-[rgba(12,12,12,0.5)] border border-[rgba(255,255,255,0.05)] rounded-lg p-2.5 text-sm font-mono text-[var(--text)] focus:outline-none focus:border-[var(--warning)]"
                              style={{ colorScheme: 'dark' }}
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => handleSaveAndNext('call_back')}
                          disabled={isSavingOutcome}
                          className="w-full mt-3 py-2 bg-[var(--warning)] text-black text-xs font-mono uppercase tracking-widest rounded-lg hover:opacity-90 transition-opacity active:scale-95"
                        >
                          Confirm & Save
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Optional notes */}
                <textarea 
                  value={outcomeNotes}
                  onChange={(e) => setOutcomeNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none custom-scrollbar mb-2 h-10 resize-none"
                />

                {/* Skip Lead */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] font-mono uppercase tracking-widest text-[var(--muted)] self-center mr-1">Skip:</span>
                  {[
                    { key: 'skip_bad_number', label: 'Bad #' },
                    { key: 'skip_duplicate', label: 'Duplicate' },
                    { key: 'skip_already_contacted', label: 'Contacted' },
                    { key: 'skip_call_later', label: 'Later' },
                    { key: 'skip_other', label: 'Other' },
                  ].map(skip => (
                    <button 
                      key={skip.key}
                      disabled={isSavingOutcome}
                      onClick={() => handleSaveAndNext(skip.key)}
                      className="py-1 px-2.5 rounded-lg text-[9px] font-mono transition-colors border bg-[rgba(255,255,255,0.01)] border-[rgba(255,255,255,0.05)] text-[var(--muted)] hover:text-white active:scale-95"
                    >
                      {skip.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* Quotation Modal */}
      {showQuotationForm && (
        <div key="quotation-form" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80">
          <div className="glass-card p-6 w-full max-w-md animate-in zoom-in-95" style={{ border: '1px solid rgba(200,180,138,0.15)' }}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-serif text-2xl text-[var(--text)]">New Quotation</h3>
              <button onClick={() => setShowQuotationForm(false)} className="text-[var(--muted)] hover:text-white"><X className="w-5 h-5"/></button>
            </div>

            <form onSubmit={handleCreateQuotation} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Service Name</label>
                <input required type="text" value={quotationData.service} onChange={e => setQuotationData({...quotationData, service: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none" placeholder="e.g. Website Design"/>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Price (₹)</label>
                <div className="relative">
                  <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input required type="number" value={quotationData.price} onChange={e => setQuotationData({...quotationData, price: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl pl-9 pr-4 py-2 text-sm text-[var(--text)] focus:outline-none" placeholder="35000"/>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Timeline</label>
                <input required type="text" value={quotationData.timeline} onChange={e => setQuotationData({...quotationData, timeline: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none" placeholder="e.g. 14 Days"/>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Deliverables</label>
                <textarea required rows="3" value={quotationData.deliverables} onChange={e => setQuotationData({...quotationData, deliverables: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none custom-scrollbar" placeholder={"- 5 Pages\n- Lead Form\n- Mobile Responsive"}/>
              </div>
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] mb-1">Terms</label>
                <textarea required rows="2" value={quotationData.terms} onChange={e => setQuotationData({...quotationData, terms: e.target.value})} className="w-full bg-[rgba(255,255,255,0.03)] border border-[rgba(200,180,138,0.08)] rounded-xl px-4 py-2 text-sm text-[var(--text)] focus:outline-none custom-scrollbar"/>
              </div>
              <button disabled={isSubmittingQuotation} type="submit" className="btn-primary w-full py-3 mt-4">
                {isSubmittingQuotation ? 'Generating...' : 'Generate Quotation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Hidden PDF renderer */}
      {downloadingQuote && (
        <div key="quotation-pdf" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
          <DocumentPDFTemplate ref={pdfRef} type="quotation" data={downloadingQuote} />
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ── Extracted sub-components ──

const CollapsibleSection = ({ title, icon: Icon, isOpen, toggle, children }) => (
  <div>
    <button 
      onClick={toggle}
      className="w-full flex items-center justify-between py-3 text-xs font-mono uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
    >
      <span className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-[var(--accent)]" />}
        {title}
      </span>
      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

function WebsiteReviewContent({ lead, websiteStatus, setWebsiteStatus, websiteNotes, setWebsiteNotes, handleSaveWebsiteReview, isSavingWebsite }) {
  return (
    <div className="glass-card-subtle p-4 md:p-5 rounded-xl border border-[rgba(200,180,138,0.06)] space-y-4 mb-3">
      {lead.website ? (
        <a href={lead.website} target="_blank" rel="noreferrer" className="btn-secondary w-full py-2 flex justify-center items-center gap-2 text-sm mb-2">
          Visit Website <Globe className="w-4 h-4" />
        </a>
      ) : (
        <div className="text-[var(--muted-light)] text-sm italic mb-2">No website provided.</div>
      )}

      <div className="space-y-3">
        <label className="text-xs font-medium text-[var(--muted-light)]">Status</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { id: 'not_checked', label: 'Not Checked', color: 'text-[var(--muted)]' },
            { id: 'no_website', label: 'No Website', color: 'text-[var(--danger)]' },
            { id: 'needs_redesign', label: 'Needs Redesign', color: 'text-[var(--warning)]' },
            { id: 'modern_website', label: 'Modern Website', color: 'text-[var(--success)]' }
          ].map(status => (
            <label 
              key={status.id} 
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border ${websiteStatus === status.id ? 'bg-[rgba(200,180,138,0.1)] border-[rgba(200,180,138,0.3)]' : 'border-transparent hover:bg-white/5'}`}
            >
              <input 
                type="radio" name="website_status" value={status.id} 
                checked={websiteStatus === status.id}
                onChange={(e) => { setWebsiteStatus(e.target.value); handleSaveWebsiteReview(e.target.value, undefined); }}
                className="hidden"
              />
              <div className={`w-3 h-3 rounded-full border flex items-center justify-center ${websiteStatus === status.id ? 'border-[var(--accent)]' : 'border-[var(--muted)]'}`}>
                {websiteStatus === status.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]"></div>}
              </div>
              <span className={`text-xs ${websiteStatus === status.id ? status.color : 'text-[var(--text)]'}`}>{status.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-[var(--muted-light)]">Review Notes</label>
        <textarea 
          value={websiteNotes}
          onChange={(e) => setWebsiteNotes(e.target.value)}
          onBlur={(e) => handleSaveWebsiteReview(undefined, e.target.value)}
          placeholder="e.g. Outdated design, No mobile optimization..."
          className="w-full bg-[rgba(12,12,12,0.5)] border border-[rgba(255,255,255,0.05)] rounded-lg p-3 text-sm text-[var(--text)] focus:outline-none focus:border-[rgba(200,180,138,0.3)] resize-none h-16 transition-colors custom-scrollbar"
        />
        {isSavingWebsite && <span className="text-[10px] text-[var(--accent)] animate-pulse">Saving...</span>}
      </div>
    </div>
  );
}

function TimelineContent({ lead, formatDate }) {
  return (
    <div className="space-y-3 mb-3">
      {(!lead.call_logs?.length && !lead.follow_ups?.length && !lead.lead_stage_events?.length) && (
        <div className="text-center py-4 text-[var(--muted-light)] text-sm border border-dashed border-[rgba(255,255,255,0.05)] rounded-xl">
          No activity recorded yet.
        </div>
      )}

      {[...(lead.lead_stage_events || [])].sort((x, y) => new Date(y.changed_at) - new Date(x.changed_at)).map(ev => (
        <div key={`stage-${ev.id}`} className="flex gap-3 relative">
          <div className="relative z-10 w-5 h-5 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--muted-light)] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[rgba(255,255,255,0.1)]">
            <ArrowRight className="w-3 h-3" />
          </div>
          <div className="glass-card-subtle p-3 rounded-xl flex-1 border border-[rgba(200,180,138,0.06)]">
            <div className="flex justify-between items-start gap-2">
              <span className="text-xs font-medium text-[var(--text)]">{stageLabel(ev.from_stage)} to {stageLabel(ev.to_stage)}</span>
              <span className="text-[10px] text-[var(--muted)] whitespace-nowrap">{formatDate(ev.changed_at)}</span>
            </div>
          </div>
        </div>
      ))}

      {lead.follow_ups?.map(fu => (
<div key={`fu-${fu.id}`} className="flex gap-3 relative">
          <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${fu.completed ? 'bg-[rgba(0,196,140,0.1)] text-[var(--success)]' : 'bg-[rgba(247,185,85,0.1)] text-[var(--warning)]'}`}>
            {fu.completed ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
          </div>
          <div className="glass-card-subtle p-3 rounded-xl flex-1 border border-[rgba(200,180,138,0.06)]">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-[var(--text)]">Follow Up</span>
              <span className="text-[10px] text-[var(--muted)]">{formatDate(fu.scheduled_at)}</span>
            </div>
            <p className="text-xs text-[var(--muted-light)]">{fu.notes || 'No details'}</p>
          </div>
        </div>
      ))}

      {lead.call_logs?.map(log => (
        <div key={`call-${log.id}`} className="flex gap-3 relative">
          <div className="relative z-10 w-5 h-5 rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--muted-light)] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[rgba(255,255,255,0.1)]">
            <PhoneCall className="w-3 h-3" />
          </div>
          <div className="glass-card-subtle p-3 rounded-xl flex-1 border border-[rgba(200,180,138,0.06)]">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-[var(--text)] capitalize flex items-center gap-1">
                Call <span className="text-[var(--muted-light)]">·</span>
                <span className="text-[var(--accent)]">{log.outcome.replace(/_/g, ' ')}</span>
              </span>
              <span className="text-[10px] text-[var(--muted)]">{formatDate(log.called_at)}</span>
            </div>
            {log.notes && <p className="text-xs text-[var(--muted-light)] mt-1">{log.notes}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
