import { createClient } from '@supabase/supabase-js'

// Public URL + publishable key. Safe to ship in the browser bundle — the database
// is protected by Row-Level Security, not by hiding this key.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ezwmfbuuopsnpanebtal.supabase.co'
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__wzWH_b0wD6_KkqEC4o_hw_RXQfsjCv'

export const supabase = createClient(url, key)
