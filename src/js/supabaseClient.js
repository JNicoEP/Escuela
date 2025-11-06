// js/supabaseClient.js

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
}

const supabaseClient = supabase.createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '');

export default supabaseClient;