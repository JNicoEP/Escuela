// js/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan variables de entorno: VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY');
  // Si quieres detener la ejecución en entorno dev, descomenta:
  // throw new Error('Missing Supabase environment variables');
}

const supabaseClient = createClient(SUPABASE_URL ?? '', SUPABASE_KEY ?? '');

export default supabaseClient;
// 1. Lee las variables de entorno que configuraste en Vercel.
// El prefijo 'VITE_' es necesario para que Vite las lea.
/*const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// 2. Verifica si la librería de Supabase está cargada.
// (Esto asume que cargaste Supabase-js desde un CDN en tu HTML).
if (!supabase) {
    console.error("Error: La librería de Supabase no está cargada.");
}

// 3. Crea el cliente usando las claves.
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 4. Exporta el cliente para que otros archivos JS puedan usarlo.
export default supabaseClient;*/