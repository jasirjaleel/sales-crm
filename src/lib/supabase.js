import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Read before the client starts: it clears the URL hash once it has processed the link.
export const openedFromRecoveryLink = window.location.hash.includes('type=recovery');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
