import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create guest_web/.env from .env.example and restart dev server.'
    : null

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)

export const photoBucket =
  import.meta.env.VITE_GUEST_PHOTO_BUCKET || 'Event Photos and Videos'

export const coverBucket =
  import.meta.env.VITE_EVENT_COVER_BUCKET || 'Event Covers'
