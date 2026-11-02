import { useEffect } from 'react';
import { motion } from 'framer-motion';


/**
 * Brief success overlay shown inside the LeadDrawer after an outcome is saved.
 * Auto-dismisses after duration ms.
 */
export default function SuccessOverlay({ outcomeLabel, onDone, duration = 400 }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onDone) onDone();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-t-[32px] md:rounded-none"
      style={{ background: 'rgba(0, 196, 140, 0.08)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 15, stiffness: 300 }}
        className="flex flex-col items-center gap-3"
      >
        {/* Animated Checkmark */}
        <div className="w-16 h-16 rounded-full bg-[rgba(0,196,140,0.15)] flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path
              d="M8 16L14 22L24 10"
              stroke="var(--success)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="checkmark-animated"
            />
          </svg>
        </div>
        
        <div className="text-center">
          <p className="text-[var(--success)] font-mono text-xs uppercase tracking-[0.2em] font-bold">Saved</p>
          {outcomeLabel && (
            <p className="text-[var(--text)] font-serif text-lg mt-1">{outcomeLabel}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
