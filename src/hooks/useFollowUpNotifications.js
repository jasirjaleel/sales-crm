import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export function useFollowUpNotifications(userId) {
  const checkIntervalRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Request permission for browser notifications
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    const checkFollowUps = async () => {
      if ('Notification' in window && Notification.permission !== 'granted') return;

      try {
        const { data: followUps, error } = await supabase
          .from('follow_ups')
          .select(`
            *,
            leads ( name )
          `)
          .eq('completed', false)
          .eq('agent_id', userId)
          .gte('scheduled_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .lte('scheduled_at', new Date(Date.now() + 10 * 60 * 1000).toISOString());

        if (error) throw error;
        if (!followUps) return;

        const now = new Date();
        const notifiedList = JSON.parse(localStorage.getItem('crm_notified_fu') || '{}');

        followUps.forEach(fu => {
          const scheduledDate = new Date(fu.scheduled_at);
          const timeDiffMs = scheduledDate.getTime() - now.getTime();
          const timeDiffMins = timeDiffMs / (1000 * 60);

          let notificationTitle = null;
          let notificationBody = null;
          let notificationType = null;

          if (timeDiffMins <= 10 && timeDiffMins > 0) {
            // Upcoming in < 10 mins
            notificationType = 'upcoming';
            notificationTitle = `Upcoming Follow-up: ${fu.leads?.name || 'Lead'}`;
            notificationBody = `Due in ${Math.ceil(timeDiffMins)} minutes. ${fu.notes || 'Time to call back.'}`;
          } else if (timeDiffMins <= 0 && timeDiffMins > -1440) {
            // Overdue (but by less than 24 hours to avoid spamming really old ones)
            notificationType = 'overdue';
            notificationTitle = `Overdue Follow-up: ${fu.leads?.name || 'Lead'}`;
            notificationBody = `Was due ${Math.abs(Math.ceil(timeDiffMins))} minutes ago. ${fu.notes || 'Time to call back.'}`;
          }

          if (notificationTitle && notificationType) {
            // Check if already notified for THIS type for THIS follow up
            const notificationKey = `${fu.id}_${notificationType}`;
            if (!notifiedList[notificationKey]) {
              new Notification(notificationTitle, {
                body: notificationBody,
                icon: '/favicon.svg',
              });
              notifiedList[notificationKey] = true;
            }
          }
        });

        // Save updated notified list
        localStorage.setItem('crm_notified_fu', JSON.stringify(notifiedList));
      } catch (err) {
        console.error('Error checking follow-up notifications:', err);
      }
    };

    // Initial check
    checkFollowUps();

    // Check every minute
    checkIntervalRef.current = setInterval(checkFollowUps, 60000);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [userId]);
}
