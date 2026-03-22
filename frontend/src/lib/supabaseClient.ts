import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || import.meta.env.SUPABASE_SERVICE_KEY || ''

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
